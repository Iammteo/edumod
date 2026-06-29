import { randomInt } from "node:crypto";
import { SCHOOL_CODE_LENGTH, SCHOOL_CODE_MAX_ATTEMPTS } from "./config";

// A random L-digit numeric string with no leading zero. For L=4 → "1000".."9999".
// Always returned as a string so leading digits are preserved and comparison is string-based.
export function generateSchoolCode(length = SCHOOL_CODE_LENGTH): string {
  if (length < 1) throw new Error("School code length must be >= 1");
  const min = 10 ** (length - 1); // smallest L-digit number (no leading zero)
  const max = 10 ** length - 1; // largest L-digit number
  return String(randomInt(min, max + 1)); // randomInt upper bound is exclusive
}

// Generate until an unused code is found. `isTaken` checks existence (DB lookup in real use).
// Random (not sequential) + retry-on-collision; throws if the space looks exhausted.
export async function pickSchoolCode(
  isTaken: (code: string) => boolean | Promise<boolean>,
  length = SCHOOL_CODE_LENGTH,
  maxAttempts = SCHOOL_CODE_MAX_ATTEMPTS,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateSchoolCode(length);
    if (!(await isTaken(code))) return code;
  }
  throw new Error(`Could not allocate a unique ${length}-digit school code after ${maxAttempts} attempts - the code space may be exhausted.`);
}
