// School-aware RBAC. The admin picks a primary role + responsibilities; Edumod suggests a
// scoped permission matrix and a plain-English "can / cannot" summary. Pure + shared (client+server).

export const AREAS = ["students", "attendance", "exams", "results", "reports", "messages", "finance", "settings"] as const;
export type Area = (typeof AREAS)[number];
export type Level = "none" | "view" | "edit" | "approve" | "full";

export const AREA_LABELS: Record<Area, string> = { students: "Students", attendance: "Attendance", exams: "Exams", results: "Results", reports: "Reports", messages: "Messages", finance: "Finance", settings: "Settings" };
export const LEVELS: { key: Level; label: string }[] = [{ key: "view", label: "View" }, { key: "edit", label: "Create / Edit" }, { key: "approve", label: "Approve" }, { key: "full", label: "Full access" }];

export const ROLES = [
  { key: "school_admin", label: "School admin", academic: false, desc: "Full control of the school." },
  { key: "principal", label: "Principal", academic: true, desc: "School-wide academic oversight." },
  { key: "vice_principal", label: "Vice principal / Coordinator", academic: true, desc: "Academic oversight and exams." },
  { key: "teacher", label: "Teacher", academic: true, desc: "Teaches subjects; may run a class." },
  { key: "secretary", label: "Secretary", academic: false, desc: "Day-to-day administration; no settings, finance approval or staff management." },
] as const;
export type RoleKey = (typeof ROLES)[number]["key"];

export type StaffResponsibilities = {
  role: RoleKey;
  isTeacher: boolean;
  isClassTeacher: boolean;
  assignedClass?: string;
  subjects: string[];
  teachingClasses: string[];
  canApprovePayments: boolean;
};

// Which template applies (teacher splits into class vs subject by responsibility).
function templateFor(r: StaffResponsibilities): "school_admin" | "principal" | "vice_principal" | "class_teacher" | "subject_teacher" | "secretary" | "staff" {
  if (r.role === "teacher") return r.isClassTeacher ? "class_teacher" : "subject_teacher";
  if (r.role === "school_admin" || r.role === "principal" || r.role === "vice_principal" || r.role === "secretary") return r.role;
  return "staff";
}

const TEMPLATES: Record<string, Record<Area, Level>> = {
  school_admin: { students: "full", attendance: "full", exams: "full", results: "full", reports: "full", messages: "full", finance: "full", settings: "full" },
  principal: { students: "view", attendance: "view", exams: "view", results: "approve", reports: "view", messages: "edit", finance: "view", settings: "view" },
  vice_principal: { students: "view", attendance: "view", exams: "edit", results: "edit", reports: "view", messages: "edit", finance: "none", settings: "none" },
  class_teacher: { students: "edit", attendance: "edit", exams: "edit", results: "edit", reports: "view", messages: "edit", finance: "none", settings: "none" },
  subject_teacher: { students: "view", attendance: "none", exams: "edit", results: "edit", reports: "view", messages: "none", finance: "none", settings: "none" },
  secretary: { students: "full", attendance: "full", exams: "edit", results: "edit", reports: "view", messages: "edit", finance: "edit", settings: "none" },
  staff: { students: "view", attendance: "none", exams: "none", results: "none", reports: "none", messages: "none", finance: "none", settings: "none" },
};

export function buildMatrix(r: StaffResponsibilities): Record<Area, Level> {
  const m = { ...TEMPLATES[templateFor(r)] };
  // Finance approver is an assignable capability layered on top.
  if (r.canApprovePayments && m.finance !== "full") m.finance = "approve";
  return m;
}

const subjectList = (r: StaffResponsibilities) => (r.subjects.length ? r.subjects.join(", ") : "their subjects");
const classScope = (r: StaffResponsibilities) => r.assignedClass || (r.teachingClasses[0] ?? "their classes");

// Plain-English summary, scoped to the actual subjects/classes assigned.
export function buildSummary(r: StaffResponsibilities): { can: string[]; cannot: string[] } {
  const t = templateFor(r);
  const can: string[] = [];
  const cannot: string[] = [];
  if (t === "school_admin") {
    return { can: ["Manage the whole school", "Add staff and students", "Assign roles and responsibilities", "Approve payments", "Edit school settings"], cannot: [] };
  }
  if (t === "class_teacher") {
    can.push(`Mark attendance for ${classScope(r)}`, `View student records in ${classScope(r)}`, `Enter results for ${subjectList(r)}`, `Message parents in ${classScope(r)}`);
  } else if (t === "subject_teacher") {
    can.push(`Create exam sessions for ${subjectList(r)}`, `Upload results for ${subjectList(r)}`, `View students in ${r.teachingClasses.length ? r.teachingClasses.join(", ") : "their teaching classes"}`);
    cannot.push("Mark daily attendance (not a class teacher)");
  } else if (t === "principal" || t === "vice_principal") {
    can.push("View all students, staff and classes", "Review attendance and performance", "Manage exams and review results");
    if (t === "principal") can.push("Review results before publication");
  } else if (t === "secretary") {
    can.push("Manage students, classes and attendance", "Record payments and issue invoices", "View finances and reports");
    cannot.push("Approve payments or refunds");
  }
  if (r.canApprovePayments && r.role !== "secretary") can.push("Approve payments recorded by others");
  // universal "cannot" for non-admins
  if (t !== "secretary") cannot.push("View school finances");
  if (!r.canApprovePayments) cannot.push("Approve payments");
  cannot.push("Edit school settings", "Manage other staff accounts");
  return { can, cannot: Array.from(new Set(cannot)) };
}
