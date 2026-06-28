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
function randomDigits(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += pick(DIGIT);
  return s;
}
function cap(w: string): string {
  return w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : "";
}

// Plain readable random password (fallback when no school name is available).
function randomReadable(length: number): string {
  const chars = [pick(LOWER), pick(UPPER), pick(DIGIT)];
  while (chars.length < length) chars.push(pick(ALL));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// School-branded student password: a recognisable prefix from the school's name + random digits.
// e.g. "Soland International School" → "SIS2345" / "Soland234" / "Sol223". Memorable for a young
// student, still randomised. Pass no name to fall back to a plain readable password.
export function generateStudentPassword(schoolName?: string, length = STUDENT_PASSWORD_LENGTH): string {
  const words = (schoolName ?? "").replace(/[^A-Za-z\s]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return randomReadable(length);

  const initials = words.slice(0, 4).map((w) => w[0]!.toUpperCase()).join("");
  const candidates = [initials, cap(words[0]), cap(words[0].slice(0, 3)), cap(words[0].slice(0, 4))].filter((p) => p.length >= 3 && p.length <= 8);
  const prefix = candidates.length ? candidates[randomInt(candidates.length)] : (cap(words[0].slice(0, 3)) || "Std");

  const targetTotal = 6 + randomInt(4); // 6–9 chars total
  const digits = Math.max(3, targetTotal - prefix.length);
  return prefix + randomDigits(digits);
}
