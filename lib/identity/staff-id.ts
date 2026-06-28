import { randomInt } from "node:crypto";

// School-branded, self-contained Staff ID, e.g. "SIS482147". Embeds the globally-unique numeric
// school code so the ID alone identifies the staffer at login (no separate school code needed).
// Initials come from the school name; a 2-digit suffix disambiguates staff within the school.
// The caller checks the resulting username for global uniqueness and retries on collision.
export function generateStaffId(schoolName: string | undefined, schoolCode: string): string {
  const words = (schoolName ?? "").replace(/[^A-Za-z\s]/g, " ").split(/\s+/).filter(Boolean);
  const initials = (words.slice(0, 3).map((w) => w[0]!.toUpperCase()).join("") || "STF").slice(0, 3);
  return `${initials}${schoolCode}${randomInt(10, 100)}`;
}
