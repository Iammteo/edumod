import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import * as schema from "@/db/schema";

// Social providers are enabled only when their credentials are present, so the
// app runs locally without them and lights them up once keys are added.
const socialProviders: Record<string, Record<string, string | undefined>> = {};
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET };
}
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  socialProviders.apple = { clientId: process.env.APPLE_CLIENT_ID, clientSecret: process.env.APPLE_CLIENT_SECRET, appBundleIdentifier: process.env.APPLE_APP_BUNDLE_IDENTIFIER };
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", usePlural: true, schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Verification is disabled so the app is usable before an email provider is
    // wired. Set to true (and implement the email below) for production.
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      // Replace with the Resend or Brevo adapter. This stays server-only.
      console.info(`Password reset for ${user.email}: ${url}`);
    },
  },
  user: {
    additionalFields: {
      // Drives which dashboard a user lands on: "admin" | "staff" | "student".
      accountType: { type: "string", required: false, defaultValue: "student", input: true },
    },
  },
  socialProviders,
  plugins: [
    // Students log in with a composed username "schoolcode:studentid" (no email). The default
    // validator only allows [a-zA-Z0-9_.], so widen it to permit ":" and "-".
    username({
      minUsernameLength: 3,
      maxUsernameLength: 64,
      usernameValidator: (value: string) => /^[a-z0-9:_.-]+$/.test(value),
    }),
    // Must be last: lets sign-in called from a server action set the session cookie.
    nextCookies(),
  ],
});