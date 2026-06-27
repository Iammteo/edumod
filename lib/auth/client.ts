import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, usernameClient, emailOTPClient } from "better-auth/client/plugins";
import type { auth } from "./index";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || undefined,
  plugins: [inferAdditionalFields<typeof auth>(), usernameClient(), emailOTPClient()],
});

export const { signIn, signUp, signOut, useSession, requestPasswordReset, resetPassword } = authClient;

export type AccountType = "admin" | "staff" | "student";
