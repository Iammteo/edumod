"use client";

import { useCallback, useEffect, useState } from "react";
import { SCHOOL_CLASSES } from "@/lib/classes";
import { listClasses } from "@/lib/actions/school-classes";

// Shared loader so every class picker reflects admin-created classes. Starts with the built-in
// defaults so dropdowns are never empty, then swaps in the school's full (merged) list.
export function useClassNames(): string[] {
  const [names, setNames] = useState<string[]>(SCHOOL_CLASSES);
  useEffect(() => { listClasses().then((cs) => { if (cs.length) setNames(cs.map((c) => c.name)); }); }, []);
  return names;
}

export function useManagedClasses() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listClasses>> | null>(null);
  const reload = useCallback(() => listClasses().then(setRows), []);
  useEffect(() => { reload(); }, [reload]);
  return { rows, reload };
}
