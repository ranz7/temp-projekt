CREATE TABLE "benchmark__scaling_run_" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"problem_id_" uuid NOT NULL,
	"language_" varchar(32) NOT NULL,
	"submissions_per_step_" integer NOT NULL,
	"max_machines_" integer NOT NULL,
	"status_" varchar(16) DEFAULT 'running' NOT NULL,
	"last_error_" text,
	"started_at_" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at_" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "benchmark__scaling_step_" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"run_id_" uuid NOT NULL,
	"batch_id_" uuid,
	"machine_count_" integer NOT NULL,
	"started_at_" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at_" timestamp with time zone,
	CONSTRAINT "benchmark__scaling_step__rung__unique_" UNIQUE("run_id_","machine_count_")
);
--> statement-breakpoint
ALTER TABLE "benchmark__batch_" ADD COLUMN "correct_percent_" integer DEFAULT 70 NOT NULL;--> statement-breakpoint
ALTER TABLE "benchmark__scaling_run_" ADD CONSTRAINT "benchmark__scaling_run__problem__fk_" FOREIGN KEY ("problem_id_") REFERENCES "public"."task__problem_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benchmark__scaling_step_" ADD CONSTRAINT "benchmark__scaling_step__run__fk_" FOREIGN KEY ("run_id_") REFERENCES "public"."benchmark__scaling_run_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benchmark__scaling_step_" ADD CONSTRAINT "benchmark__scaling_step__batch__fk_" FOREIGN KEY ("batch_id_") REFERENCES "public"."benchmark__batch_"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "benchmark__scaling_run__started__idx_" ON "benchmark__scaling_run_" USING btree ("started_at_");--> statement-breakpoint
CREATE UNIQUE INDEX "benchmark__scaling_run__single_running__unique_idx_" ON "benchmark__scaling_run_" USING btree ("status_") WHERE "benchmark__scaling_run_"."status_" = 'running';--> statement-breakpoint
CREATE INDEX "benchmark__scaling_step__run__idx_" ON "benchmark__scaling_step_" USING btree ("run_id_");