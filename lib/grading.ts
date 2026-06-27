// Nigerian-style grading: CA (out of 40) + Exam (out of 60) = 100.
export function gradeFor(score: number): { grade: string; remark: string } {
  if (score >= 70) return { grade: "A", remark: "Excellent" };
  if (score >= 60) return { grade: "B", remark: "Very good" };
  if (score >= 50) return { grade: "C", remark: "Credit" };
  if (score >= 45) return { grade: "D", remark: "Pass" };
  if (score >= 40) return { grade: "E", remark: "Fair" };
  return { grade: "F", remark: "Fail" };
}
