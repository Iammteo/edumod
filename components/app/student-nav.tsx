"use client";

import { createContext, useContext } from "react";

// App-wide "open this student's profile" hook. AdminApp provides it; anywhere a student name is shown
// inside the admin app, wrap it in <StudentLink> so clicking jumps to the profile.
const StudentNavContext = createContext<{ openStudent: (studentId: string) => void } | null>(null);
export const StudentNavProvider = StudentNavContext.Provider;
export function useStudentNav() { return useContext(StudentNavContext); }

// Renders a student's name as a link to their profile when navigation is available, else plain text.
export function StudentLink({ studentId, name, className }: { studentId?: string | null; name: string; className?: string }) {
  const nav = useStudentNav();
  if (!nav || !studentId) return <span className={className}>{name}</span>;
  return <button type="button" onClick={(e) => { e.stopPropagation(); nav.openStudent(studentId); }} className={`text-left hover:text-brand-blue hover:underline ${className ?? ""}`}>{name}</button>;
}
