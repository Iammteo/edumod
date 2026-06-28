ALTER TABLE "fee_structures" ADD COLUMN "items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "mandatory" boolean DEFAULT true NOT NULL;