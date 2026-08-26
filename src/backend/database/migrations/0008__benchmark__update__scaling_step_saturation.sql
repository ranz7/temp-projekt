ALTER TABLE "benchmark__scaling_step_" ADD COLUMN "busy_samples_" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "benchmark__scaling_step_" ADD COLUMN "busy_total_" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "benchmark__scaling_step_" ADD COLUMN "capacity_total_" integer DEFAULT 0 NOT NULL;