import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, schools } from "@/db/schema";
import { AdminDashboard, StaffDashboard, StudentDashboard } from "@/components/app/dashboards";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const role = (session.user as { accountType?: string }).accountType ?? "student";
  const name = session.user.name || session.user.email || "there";

  const [membership] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  const school = membership ? (await db.select().from(schools).where(eq(schools.id, membership.schoolId)).limit(1))[0] : undefined;
  const props = { userName: name, schoolName: school?.name ?? "Your school", schoolCode: school?.schoolCode ?? "—" };

  if (role === "admin") return <AdminDashboard {...props} />;
  if (role === "staff") return <StaffDashboard {...props} />;
  return <StudentDashboard {...props} />;
}
