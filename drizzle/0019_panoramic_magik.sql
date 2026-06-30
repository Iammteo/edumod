CREATE INDEX "invoices_student_idx" ON "invoices" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "invoices_fee_structure_idx" ON "invoices" USING btree ("fee_structure_id");--> statement-breakpoint
CREATE INDEX "payments_student_idx" ON "payments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "students_school_class_idx" ON "students" USING btree ("school_id","class_name");