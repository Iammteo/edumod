ALTER TYPE "public"."membership_role" ADD VALUE 'vice_principal' BEFORE 'bursar';--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD COLUMN "employment_type" varchar(30);--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD COLUMN "job_role" varchar(60);--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD COLUMN "status" varchar(20) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD COLUMN "is_teacher" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD COLUMN "is_class_teacher" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD COLUMN "assigned_class" varchar(80);--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD COLUMN "subjects" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD COLUMN "teaching_classes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD COLUMN "permissions" jsonb DEFAULT '{}'::jsonb NOT NULL;