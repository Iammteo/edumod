ALTER TABLE "staff_profiles" ADD COLUMN "invite_token" text;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD COLUMN "profile" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_invite_token_unique" UNIQUE("invite_token");