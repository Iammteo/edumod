import type { Metadata } from "next";
import { AuthScreen } from "@/components/auth/auth-screen";

export const metadata: Metadata = {
  title: "Log in | Edumod",
  description: "Log in to your Edumod school workspace.",
};

export default function LoginPage() {
  return <AuthScreen mode="login" />;
}
