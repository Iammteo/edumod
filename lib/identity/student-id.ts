import { STUDENT_SEQ_PAD } from "./config";

// 2-digit calendar year, zero-padded ("2026" → "26", "2000" → "00").
export function twoDigitYear(year: number): string {
  return String(year % 100).padStart(2, "0");
}

// Student ID in the form YY-NNNNN, e.g. (2026, 1925) → "26-01925". Stored as a string.
export function formatStudentId(year: number, seq: number, pad = STUDENT_SEQ_PAD): string {
  if (seq < 1) throw new Error("Student sequence must be >= 1");
  const body = String(seq);
  if (body.length > pad) throw new Error(`Student sequence ${seq} overflows ${pad} digits`);
  return `${twoDigitYear(year)}-${body.padStart(pad, "0")}`;
}

export function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

// The internal Better Auth username the student never sees or types: "schoolcode:studentid".
// Composed server-side from the two values the student does enter.
export function composeUsername(schoolCode: string, studentId: string): string {
  return `${normalizeIdentifier(schoolCode)}:${normalizeIdentifier(studentId)}`;
}
