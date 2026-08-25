CREATE TABLE "machine__machine_" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name_" varchar(64) NOT NULL,
	"address_" varchar(255) NOT NULL,
	"local_port_" integer NOT NULL,
	"enabled_" boolean DEFAULT true NOT NULL,
	"reachable_" boolean DEFAULT false NOT NULL,
	"capacity_" integer DEFAULT 0 NOT NULL,
	"busy_" integer DEFAULT 0 NOT NULL,
	"version_" varchar(64),
	"problems_" text[] DEFAULT '{}' NOT NULL,
	"judged_total_" integer DEFAULT 0 NOT NULL,
	"last_seen_at_" timestamp with time zone,
	"last_error_" text,
	"created_at_" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submission__submission_" ADD COLUMN "machine_id_" uuid;--> statement-breakpoint
ALTER TABLE "submission__submission_" ADD COLUMN "checker_job_id_" varchar(64);--> statement-breakpoint
ALTER TABLE "task__problem_" ADD COLUMN "statement_markdown_" text;--> statement-breakpoint
CREATE UNIQUE INDEX "machine__machine__name__unique_idx_" ON "machine__machine_" USING btree ("name_");--> statement-breakpoint
ALTER TABLE "submission__submission_" ADD CONSTRAINT "submission__submission__machine__fk_" FOREIGN KEY ("machine_id_") REFERENCES "public"."machine__machine_"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submission__submission__machine__idx_" ON "submission__submission_" USING btree ("machine_id_");--> statement-breakpoint
ALTER TABLE "submission__submission_" DROP COLUMN "queue_published_at_";