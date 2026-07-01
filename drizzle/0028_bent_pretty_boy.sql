CREATE TABLE "exam_papers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"term" varchar(80) NOT NULL,
	"exam_type" varchar(40) NOT NULL,
	"class_name" varchar(80) NOT NULL,
	"subject" varchar(120) NOT NULL,
	"exam_date" date NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"room" varchar(60),
	"invigilator" varchar(120),
	"is_waec" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exam_papers" ADD CONSTRAINT "exam_papers_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_papers_school_term_idx" ON "exam_papers" USING btree ("school_id","term");