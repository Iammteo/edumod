import assert from "node:assert/strict";
import { test } from "node:test";
import { SCHOOL_CODE_LENGTH } from "../lib/identity/config";
import { generateSchoolCode, pickSchoolCode } from "../lib/identity/school-code";
import { composeUsername, formatStudentId, twoDigitYear } from "../lib/identity/student-id";
import { generateStudentPassword } from "../lib/identity/password";

/* ---------------- School code ---------------- */
test("school code: L digits, no leading zero, in range, always a string", () => {
  for (let i = 0; i < 5000; i++) {
    const c = generateSchoolCode();
    assert.equal(typeof c, "string");
    assert.equal(c.length, SCHOOL_CODE_LENGTH);
    assert.match(c, /^[1-9][0-9]*$/);
    const n = Number(c);
    assert.ok(n >= 1000 && n <= 9999, `out of range: ${c}`);
  }
});

test("school code length is configurable (5-digit) without code change", () => {
  for (let i = 0; i < 1000; i++) {
    const c = generateSchoolCode(5);
    assert.equal(c.length, 5);
    const n = Number(c);
    assert.ok(n >= 10000 && n <= 99999);
  }
});

test("pickSchoolCode retries past taken codes (collision path)", async () => {
  let calls = 0;
  const isTaken = () => { calls += 1; return calls <= 3; }; // first 3 taken, 4th free
  const code = await pickSchoolCode(isTaken);
  assert.match(code, /^[1-9][0-9]{3}$/);
  assert.ok(calls >= 4, `expected retries, got ${calls} calls`);
});

test("pickSchoolCode throws when the space is exhausted", async () => {
  await assert.rejects(() => pickSchoolCode(() => true, SCHOOL_CODE_LENGTH, 10), /exhausted/);
});

/* ---------------- Student ID ---------------- */
test("student ID: YY-NNNNN, zero-padded, stored as string", () => {
  assert.equal(formatStudentId(2026, 1925), "26-01925");
  assert.equal(formatStudentId(2026, 1), "26-00001");
  assert.equal(formatStudentId(2030, 99999), "30-99999");
  assert.equal(twoDigitYear(2026), "26");
  assert.equal(twoDigitYear(2000), "00");
});

test("student ID rejects non-positive and overflowing sequences", () => {
  assert.throws(() => formatStudentId(2026, 0));
  assert.throws(() => formatStudentId(2026, 100000)); // > 5 digits
});

test("composeUsername lowercases and joins with a colon", () => {
  assert.equal(composeUsername("1000", "26-01925"), "1000:26-01925");
  assert.equal(composeUsername(" RCA ", "Stu-7"), "rca:stu-7");
});

/* ---------------- Password ---------------- */
test("student password: >= 8 chars, unambiguous charset, has lower/upper/digit", () => {
  for (let i = 0; i < 3000; i++) {
    const p = generateStudentPassword();
    assert.ok(p.length >= 8);
    assert.doesNotMatch(p, /[0O1lI]/, `ambiguous char in ${p}`);
    assert.match(p, /[a-z]/);
    assert.match(p, /[A-Z]/);
    assert.match(p, /[2-9]/);
  }
});

/* ---------------- DB: race condition + sequence (requires DATABASE_URL) ---------------- */
test("concurrent student-ID allocation yields unique, gap-free sequential IDs", { skip: !process.env.DATABASE_URL }, async () => {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../lib/db");
  const schema = await import("../db/schema");
  const { allocateStudentId } = await import("../lib/identity/allocate");

  const code = `T${String(Date.now()).slice(-5)}`;
  const [school] = await db.insert(schema.schools).values({ name: "Race Test", slug: `race-${code}`, schoolCode: code }).returning();
  try {
    const year = 2026;
    const N = 50;
    const results = await Promise.all(Array.from({ length: N }, () => allocateStudentId(db, school.id, year)));
    const seqs = results.map((r) => r.seq).sort((a, b) => a - b);
    assert.deepEqual(seqs, Array.from({ length: N }, (_, i) => i + 1), "sequences must be 1..N with no gaps/dupes");
    assert.equal(new Set(results.map((r) => r.admissionNo)).size, N, "admission numbers must be unique");
    assert.equal(results[0].admissionNo.split("-")[0], "26");
  } finally {
    await db.delete(schema.studentSequences).where(eq(schema.studentSequences.schoolId, school.id));
    await db.delete(schema.schools).where(eq(schema.schools.id, school.id));
  }
});
