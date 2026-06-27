CREATE TABLE "student_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"term" varchar(80) NOT NULL,
	"subject" varchar(120) NOT NULL,
	"ca" integer DEFAULT 0 NOT NULL,
	"exam" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_result_unique" UNIQUE("student_id","term","subject")
);
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "profile" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "student_results" ADD CONSTRAINT "student_results_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_results" ADD CONSTRAINT "student_results_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_results_school_term_idx" ON "student_results" USING btree ("school_id","term");