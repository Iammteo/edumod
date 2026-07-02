"use client";

import { useEffect, useState } from "react";
import { listAcademicTerms } from "@/lib/actions/academics";

// Shared loader for the school's REAL academic periods (its admin-created session/term pairs plus the
// active one) as "Session · Term" strings, with the current one flagged. Replaces the hardcoded term
// arrays so results/fees are recorded against terms that actually exist for the school.
export function useAcademicTerms(): { terms: string[]; current: string; loaded: boolean } {
  const [state, setState] = useState<{ terms: string[]; current: string; loaded: boolean }>({ terms: [], current: "", loaded: false });
  useEffect(() => {
    listAcademicTerms().then((rows) => {
      const terms = rows.map((r) => `${r.session} · ${r.term}`);
      const cur = rows.find((r) => r.current);
      setState({ terms, current: cur ? `${cur.session} · ${cur.term}` : terms[0] ?? "", loaded: true });
    }).catch(() => setState((s) => ({ ...s, loaded: true })));
  }, []);
  return state;
}
