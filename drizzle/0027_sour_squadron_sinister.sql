CREATE TABLE "timetable_meta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"class_name" varchar(80) NOT NULL,
	"title" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "timetable_meta_unique" UNIQUE("school_id","class_name")
);
--> statement-breakpoint
ALTER TABLE "timetable_meta" ADD CONSTRAINT "timetable_meta_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;