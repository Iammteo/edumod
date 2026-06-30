// One place for money + role-label formatting, so the same value renders identically everywhere
// (previously `naira` was redefined ~8× with divergent rounding, and the role label map ~5×).

export function formatNaira(n: unknown): string {
  return `₦${(Number(n) || 0).toLocaleString()}`;
}

// Compact form for headline stats: ₦1.2M / ₦450k / ₦999.
export function compactNaira(n: unknown): string {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1000) return `₦${(v / 1000).toFixed(0)}k`;
  return `₦${v}`;
}

const ROLE_LABELS: Record<string, string> = {
  school_admin: "Admin",
  principal: "Principal",
  vice_principal: "Vice principal",
  secretary: "Secretary",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};

export function roleLabel(role: string | null | undefined): string {
  return (role && ROLE_LABELS[role]) || role || "Staff";
}
