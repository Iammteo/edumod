import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthScreen } from "@/components/auth/auth-screen";

export const metadata: Metadata = {
  title: "Sign up | Edumod",
  description: "Create your Edumod school workspace.",
};

export default async function SignupPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");
  return <AuthScreen mode="signup" />;
}
