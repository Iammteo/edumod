import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Forgot password | Edumod" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
