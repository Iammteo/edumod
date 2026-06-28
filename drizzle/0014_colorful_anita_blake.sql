CREATE TYPE "public"."attendance_direction" AS ENUM('clock_in', 'clock_out');--> statement-breakpoint
CREATE TYPE "public"."attendance_method" AS ENUM('qr_scan', 'kiosk_pin', 'admin_override');--> statement-breakpoint
CREATE TABLE "teacher_attendance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"teacher_id" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"direction" "attendance_direction" NOT NULL,
	"verification_method" "attendance_method" NOT NULL,
	"snapshot_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teacher_attendance_logs" ADD CONSTRAINT "teacher_attendance_logs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_attendance_logs" ADD CONSTRAINT "teacher_attendance_logs_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_logs_school_time_idx" ON "teacher_attendance_logs" USING btree ("school_id","timestamp");--> statement-breakpoint
CREATE INDEX "attendance_logs_teacher_time_idx" ON "teacher_attendance_logs" USING btree ("teacher_id","timestamp");