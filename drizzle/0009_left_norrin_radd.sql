ALTER TABLE "payments" DROP CONSTRAINT "payment_approver_differs_from_recorder";--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "require_approval" boolean DEFAULT false NOT NULL;