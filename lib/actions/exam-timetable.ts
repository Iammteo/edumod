"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/auth/context";
import { examPapers } from "@/db/schema";
import { logAudit } from "@/lib/audit";

export const EXAM_TYPES = ["Mock", "Continuous Assessment", "Mid-term", "Terminal Exam", "WAEC-style"] as const;

export type ExamPaper = {
  id: string; term: string; examType: string; className: string; subject: string;
  examDate: string; startTime: string; endTime: string; room: string | null; invigilator: string | null; isWaec: boolean; notes: string | null;
};
export type ExamClash = { kind: "room" | "class" | "invigilator"; name: string; examDate: string; startTime: string; endTime: string; papers: { subject: string; className: string }[] };
export type ExamTimetable = {
  papers: ExamPaper[];
  stats: { papers: number; examDays: number; invigilators: number; clashes: number };
  clashes: ExamClash[];
};

async function ctx() {
  const a = await getAuthContext();
  if (!a) return null;
  return { userId: a.userId, schoolId: a.schoolId, role: a.role, canManage: ["school_admin", "principal", "vice_principal", "secretary"].includes(a.role) };
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const clean = (v: string, n: number) => v.trim().replace(/\s+/g, " ").slice(0, n);

// Two papers on the same day overlap if their [start,end) intervals intersect (zero-padded HH:MM sorts lexically).
function overlaps(a: ExamPaper, b: ExamPaper) {
  return a.examDate === b.examDate && a.startTime < b.endTime && b.startTime < a.endTime;
}
function detectClashes(papers: ExamPaper[]): ExamClash[] {
  const out: ExamClash[] = [];
  const seen = new Set<string>();
  const add = (kind: ExamClash["kind"], name: string, a: ExamPaper, b: ExamPaper) => {
    const key = `${kind}|${name.toLowerCase()}|${a.examDate}|${[a.id, b.id].sort().join("-")}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, name, examDate: a.examDate, startTime: a.startTime < b.startTime ? a.startTime : b.startTime, endTime: a.endTime > b.endTime ? a.endTime : b.endTime, papers: [{ subject: a.subject, className: a.className }, { subject: b.subject, className: b.className }] });
  };
  for (let i = 0; i < papers.length; i++) {
    for (let j = i + 1; j < papers.length; j++) {
      const a = papers[i], b = papers[j];
      if (!overlaps(a, b)) continue;
      if (a.room && b.room && a.room.toLowerCase() === b.room.toLowerCase()) add("room", a.room, a, b);
      if (a.className.toLowerCase() === b.className.toLowerCase()) add("class", a.className, a, b);
      if (a.invigilator && b.invigilator && a.invigilator.toLowerCase() === b.invigilator.toLowerCase()) add("invigilator", a.invigilator, a, b);
    }
  }
  return out.sort((x, y) => x.examDate.localeCompare(y.examDate) || x.startTime.localeCompare(y.startTime));
}

export async function getExamTimetable(term: string): Promise<ExamTimetable> {
  const c = await ctx();
  const t = clean(term, 80);
  const empty = { papers: [], stats: { papers: 0, examDays: 0, invigilators: 0, clashes: 0 }, clashes: [] };
  if (!c || !t) return empty;
  const rows = await db.select().from(examPapers).where(and(eq(examPapers.schoolId, c.schoolId), eq(examPapers.term, t)));
  const papers: ExamPaper[] = rows
    .map((r) => ({ id: r.id, term: r.term, examType: r.examType, className: r.className, subject: r.subject, examDate: r.examDate, startTime: r.startTime, endTime: r.endTime, room: r.room, invigilator: r.invigilator, isWaec: r.isWaec, notes: r.notes }))
    .sort((a, b) => a.examDate.localeCompare(b.examDate) || a.startTime.localeCompare(b.startTime) || a.className.localeCompare(b.className));
  const clashes = detectClashes(papers);
  return {
    papers,
    stats: {
      papers: papers.length,
      examDays: new Set(papers.map((p) => p.examDate)).size,
      invigilators: new Set(papers.map((p) => p.invigilator).filter(Boolean)).size,
      clashes: clashes.length,
    },
    clashes,
  };
}

export async function addExamPaper(input: {
  term: string; examType: string; className: string; subject: string; examDate: string;
  startTime: string; endTime: string; room?: string; invigilator?: string; isWaec?: boolean; notes?: string;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission to edit the exam timetable." };
  const term = clean(input.term, 80);
  const examType = clean(input.examType, 40);
  const className = clean(input.className, 80);
  const subject = clean(input.subject, 120);
  const examDate = input.examDate.trim();
  const startTime = input.startTime.trim(), endTime = input.endTime.trim();
  if (!term) return { error: "Pick a session / term." };
  if (!className || !subject) return { error: "Choose a class and a subject." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate)) return { error: "Pick a valid paper date." };
  if (!HHMM.test(startTime) || !HHMM.test(endTime)) return { error: "Enter valid start and end times." };
  if (endTime <= startTime) return { error: "The end time must be after the start time." };
  try {
    const [row] = await db.insert(examPapers).values({
      schoolId: c.schoolId, term, examType: examType || "Terminal Exam", className, subject, examDate,
      startTime, endTime, room: input.room?.trim().slice(0, 60) || null, invigilator: input.invigilator?.trim().slice(0, 120) || null,
      isWaec: !!input.isWaec, notes: input.notes?.trim().slice(0, 500) || null,
    }).returning({ id: examPapers.id });
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "exam.paper_added", entityType: "ExamTimetable", metadata: { className, subject, examDate } });
    return { ok: true, id: row.id };
  } catch {
    return { error: "Could not add that paper. Please try again." };
  }
}

export async function deleteExamPaper(id: string): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission to edit the exam timetable." };
  try {
    await db.delete(examPapers).where(and(eq(examPapers.id, id), eq(examPapers.schoolId, c.schoolId)));
    return { ok: true };
  } catch {
    return { error: "Could not remove that paper. Please try again." };
  }
}
