// Plain (non-"use server") module so both the server actions and client components can import this
// constant. A "use server" file may only export async functions, so this can't live in actions/timetable.ts.
export const TIMETABLE_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
