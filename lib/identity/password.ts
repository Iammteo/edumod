import { randomInt } from "node:crypto";
import { STUDENT_PASSWORD_LENGTH } from "./config";

// Unambiguous alphabet — excludes 0/O, 1/l/I so a password is easy to read aloud and transcribe.
const LOWER = "abcdefghijkmnpqrstuvwxyz"; // no l, o
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, O
const DIGIT = "23456789"; // no 0, 1
const ALL = LOWER + UPPER + DIGIT;

function pick(set: string): string {
  return set[randomInt(set.length)];
}

// System-generated, readable student password. Guarantees at least one lowercase, uppercase
// and digit (so it passes typical policies), then shuffles. Uses crypto, not Math.random.
export function generateStudentPassword(length = STUDENT_PASSWORD_LENGTH): string {
  if (length < 4) throw new Error("Password length must be >= 4");
  const chars = [pick(LOWER), pick(UPPER), pick(DIGIT)];
  while (chars.length < length) chars.push(pick(ALL));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
