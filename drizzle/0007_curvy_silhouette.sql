ALTER TABLE "fee_structures" ADD COLUMN "classes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "class_name" varchar(80);