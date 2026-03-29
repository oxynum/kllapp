ALTER TABLE "expenses" ADD COLUMN "attachment_url" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;