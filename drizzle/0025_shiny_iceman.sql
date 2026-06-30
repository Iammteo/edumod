ALTER TABLE "staff_profiles" ADD COLUMN "invite_otp_hash" text;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD COLUMN "invite_otp_expires_at" timestamp with time zone;