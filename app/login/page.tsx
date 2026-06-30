import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthScreen } from "@/components/auth/auth-screen";

export const metadata: Metadata = {
  title: "Log in | Edumod",
  description: "Log in to your Edumod school workspace.",
};

export default async function LoginPage() {
  // Already signed in? Skip the auth screen.
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");
  return <AuthScreen mode="login" />;
}
