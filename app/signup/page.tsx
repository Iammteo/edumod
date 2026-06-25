import type { Metadata } from "next";
import { AuthScreen } from "@/components/auth/auth-screen";

export const metadata: Metadata = {
  title: "Sign up | Edumod",
  description: "Create your Edumod school workspace.",
};

export default function SignupPage() {
  return <AuthScreen mode="signup" />;
}
