import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, usernameClient, emailOTPClient, twoFactorClient } from "better-auth/client/plugins";
import type { auth } from "./index";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || undefined,
  plugins: [inferAdditionalFields<typeof auth>(), usernameClient(), emailOTPClient(), twoFactorClient()],
});

export const { signIn, signUp, signOut, useSession, requestPasswordReset, resetPassword, listSessions, revokeSession, revokeOtherSessions, twoFactor } = authClient;

export type AccountType = "admin" | "staff" | "student";
