import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { studentSequences } from "@/db/schema";
import { formatStudentId } from "./student-id";

// Works with both the root db and a transaction handle (same type).
export type Db = NodePgDatabase<typeof schema>;

// Atomically allocate the next per-school, per-year sequence and return the formatted student ID.
//
// Race-safe: the upsert targets the (schoolId, year) primary key. The first writer inserts
// last_seq = 1; every concurrent writer hits ON CONFLICT DO UPDATE, which takes a row lock and
// increments last_seq, so Postgres serialises them — no two callers can read the same value.
// The (schoolId, admissionNo) unique constraint on `students` is the final backstop.
export async function allocateStudentId(db: Db, schoolId: string, year: number): Promise<{ admissionNo: string; seq: number }> {
  const [row] = await db
    .insert(studentSequences)
    .values({ schoolId, year, lastSeq: 1 })
    .onConflictDoUpdate({
      target: [studentSequences.schoolId, studentSequences.year],
      set: { lastSeq: sql`${studentSequences.lastSeq} + 1` },
    })
    .returning({ lastSeq: studentSequences.lastSeq });
  return { admissionNo: formatStudentId(year, row.lastSeq), seq: row.lastSeq };
}
