CREATE TABLE "school_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"event_date" date NOT NULL,
	"title" varchar(160) NOT NULL,
	"kind" varchar(24) DEFAULT 'event' NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "current_session" varchar(40) DEFAULT '2023/2024' NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "current_term" varchar(40) DEFAULT 'Term 2' NOT NULL;--> statement-breakpoint
ALTER TABLE "school_events" ADD CONSTRAINT "school_events_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_events" ADD CONSTRAINT "school_events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "school_events_school_date_idx" ON "school_events" USING btree ("school_id","event_date");