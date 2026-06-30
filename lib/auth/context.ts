import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships } from "@/db/schema";

// Shared session + membership resolution, so every server action stops re-implementing the same
// "get the signed-in user and their school membership" boilerplate. Returns null when there's no
// session or no membership; each action layers its own role/permission flags on top of this.
export type AuthContext = { userId: string; schoolId: string; role: string; canApprovePayments: boolean };

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  if (!m) return null;
  return { userId: session.user.id, schoolId: m.schoolId, role: m.role, canApprovePayments: m.canApprovePayments };
}
