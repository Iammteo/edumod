import { readFile } from "fs/promises";
import path from "path";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, payments } from "@/db/schema";

const CONTENT_TYPE: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", pdf: "application/pdf" };

// Auth-gated proof-of-payment download. Proofs are bank-transfer screenshots (account numbers), so
// they live outside /public and are only served to: (a) the receipt's holder, via ?token= matching
// the payment's receiptKey, or (b) a signed-in staff member of the payment's school.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("token");

  const [p] = await db.select({ schoolId: payments.schoolId, receiptKey: payments.receiptKey, proofKey: payments.proofKey }).from(payments).where(eq(payments.id, id)).limit(1);
  if (!p || !p.proofKey) return new Response("Not found", { status: 404 });

  let allowed = !!(token && p.receiptKey && token === p.receiptKey);
  if (!allowed) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session) {
      const [m] = await db.select({ schoolId: memberships.schoolId }).from(memberships).where(and(eq(memberships.userId, session.user.id), eq(memberships.schoolId, p.schoolId))).limit(1);
      allowed = !!m;
    }
  }
  if (!allowed) return new Response("Forbidden", { status: 403 });

  // Legacy proofs were stored under /public/uploads with a leading-slash key; new ones are bare
  // filenames under private-uploads.
  const legacy = p.proofKey.startsWith("/");
  const file = legacy ? path.join(process.cwd(), "public", p.proofKey) : path.join(process.cwd(), "private-uploads", p.proofKey);
  try {
    const buf = await readFile(file);
    const ext = (p.proofKey.split(".").pop() || "").toLowerCase();
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": CONTENT_TYPE[ext] ?? "application/octet-stream", "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=300" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
