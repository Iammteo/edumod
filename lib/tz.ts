// Timezone helpers so "today" is computed consistently in the school's timezone (not the server's
// UTC or the client's local time). Shared by attendance and any date-bounded query.

// Today's calendar date (YYYY-MM-DD) in the given IANA timezone.
export function isoDayInTz(tz: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

// Midnight "today" in the given timezone, returned as a UTC instant — so a late-night clock-in is
// counted on the correct local day even when the server runs in UTC.
export function startOfTodayTz(tz: string): Date {
  const now = new Date();
  const ymd = isoDayInTz(tz, now);
  const asUTC = new Date(`${ymd}T00:00:00Z`);
  const offsetMs = new Date(now.toLocaleString("en-US", { timeZone: tz })).getTime() - new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(asUTC.getTime() - offsetMs);
}
