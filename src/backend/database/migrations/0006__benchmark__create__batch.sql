CREATE TABLE "benchmark__batch_" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"problem_id_" uuid NOT NULL,
	"language_" varchar(32) NOT NULL,
	"requested_count_" integer NOT NULL,
	"created_count_" integer DEFAULT 0 NOT NULL,
	"status_" varchar(16) DEFAULT 'running' NOT NULL,
	"last_error_" text,
	"started_at_" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at_" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "benchmark__batch_submission_" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"batch_id_" uuid NOT NULL,
	"submission_id_" uuid NOT NULL,
	"expects_accepted_" boolean NOT NULL,
	"created_at_" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "benchmark__batch_submission__submission__unique_" UNIQUE("submission_id_")
);
--> statement-breakpoint
ALTER TABLE "benchmark__batch_" ADD CONSTRAINT "benchmark__batch__problem__fk_" FOREIGN KEY ("problem_id_") REFERENCES "public"."task__problem_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benchmark__batch_submission_" ADD CONSTRAINT "benchmark__batch_submission__batch__fk_" FOREIGN KEY ("batch_id_") REFERENCES "public"."benchmark__batch_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benchmark__batch_submission_" ADD CONSTRAINT "benchmark__batch_submission__submission__fk_" FOREIGN KEY ("submission_id_") REFERENCES "public"."submission__submission_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "benchmark__batch__started__idx_" ON "benchmark__batch_" USING btree ("started_at_");--> statement-breakpoint
CREATE UNIQUE INDEX "benchmark__batch__single_running__unique_idx_" ON "benchmark__batch_" USING btree ("status_") WHERE "benchmark__batch_"."status_" = 'running';--> statement-breakpoint
CREATE INDEX "benchmark__batch_submission__batch__idx_" ON "benchmark__batch_submission_" USING btree ("batch_id_");