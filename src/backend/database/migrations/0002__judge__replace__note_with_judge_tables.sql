DROP TABLE IF EXISTS "note__note_";
--> statement-breakpoint
CREATE TABLE "account__user_" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"username_" varchar(64) NOT NULL,
	"created_at_" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission__submission_" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"problem_id_" uuid NOT NULL,
	"user_id_" uuid NOT NULL,
	"language_" varchar(32) NOT NULL,
	"source_code_" text NOT NULL,
	"status_" varchar(32) DEFAULT 'queued' NOT NULL,
	"score_" integer,
	"max_score_" integer,
	"compile_message_" text,
	"judge_message_" text,
	"max_cpu_ms_" integer,
	"max_memory_kb_" integer,
	"created_at_" timestamp with time zone DEFAULT now() NOT NULL,
	"judged_at_" timestamp with time zone,
	"lease_expires_at_" timestamp with time zone,
	"judge_claim_id_" uuid,
	"judge_attempts_" integer DEFAULT 0 NOT NULL,
	"queue_published_at_" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "submission__test_result_" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"submission_id_" uuid NOT NULL,
	"problem_test_id_" uuid NOT NULL,
	"ordinal_" integer NOT NULL,
	"visibility_" varchar(16) NOT NULL,
	"verdict_" varchar(32) NOT NULL,
	"passed_" boolean NOT NULL,
	"points_awarded_" integer DEFAULT 0 NOT NULL,
	"message_" text,
	"actual_output_" text,
	"time_ms_" integer,
	"memory_kb_" integer,
	CONSTRAINT "submission__test_result__submission_problem_test__unique_" UNIQUE("submission_id_","problem_test_id_")
);
--> statement-breakpoint
CREATE TABLE "task__problem_" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"slug_" varchar(128) NOT NULL,
	"code_" varchar(32) NOT NULL,
	"title_" varchar(256) NOT NULL,
	"statement_" text NOT NULL,
	"statement_input_" text,
	"statement_output_" text,
	"statement_notes_" text,
	"difficulty_" varchar(16) NOT NULL,
	"rating_" integer,
	"tags_" text[] DEFAULT '{}' NOT NULL,
	"kind_" varchar(32) DEFAULT 'stdio' NOT NULL,
	"io_mode_" varchar(32) DEFAULT 'stdio' NOT NULL,
	"languages_" text[] NOT NULL,
	"time_limit_ms_" integer NOT NULL,
	"memory_limit_mb_" integer NOT NULL,
	"checker_type_" varchar(16) DEFAULT 'token' NOT NULL,
	"checker_path_" varchar(512),
	"package_dir_" varchar(512) NOT NULL,
	"is_published_" boolean DEFAULT true NOT NULL,
	"created_at_" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task__problem_test_" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"problem_id_" uuid NOT NULL,
	"ordinal_" integer NOT NULL,
	"visibility_" varchar(16) NOT NULL,
	"input_" text,
	"expected_output_" text,
	"explanation_" text,
	"input_member_" varchar(512),
	"output_member_" varchar(512),
	"points_" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "task__problem_test__problem_visibility_ordinal__unique_" UNIQUE("problem_id_","visibility_","ordinal_")
);
--> statement-breakpoint
ALTER TABLE "submission__submission_" ADD CONSTRAINT "submission__submission__problem__fk_" FOREIGN KEY ("problem_id_") REFERENCES "public"."task__problem_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission__submission_" ADD CONSTRAINT "submission__submission__user__fk_" FOREIGN KEY ("user_id_") REFERENCES "public"."account__user_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission__test_result_" ADD CONSTRAINT "submission__test_result__submission__fk_" FOREIGN KEY ("submission_id_") REFERENCES "public"."submission__submission_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission__test_result_" ADD CONSTRAINT "submission__test_result__problem_test__fk_" FOREIGN KEY ("problem_test_id_") REFERENCES "public"."task__problem_test_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task__problem_test_" ADD CONSTRAINT "task__problem_test__problem__fk_" FOREIGN KEY ("problem_id_") REFERENCES "public"."task__problem_"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account__user__username__unique_idx_" ON "account__user_" USING btree ("username_");--> statement-breakpoint
CREATE INDEX "submission__submission__problem__idx_" ON "submission__submission_" USING btree ("problem_id_");--> statement-breakpoint
CREATE INDEX "submission__submission__user__idx_" ON "submission__submission_" USING btree ("user_id_");--> statement-breakpoint
CREATE INDEX "submission__submission__queued__idx_" ON "submission__submission_" USING btree ("problem_id_","created_at_") WHERE "submission__submission_"."status_" = 'queued';--> statement-breakpoint
CREATE INDEX "submission__test_result__submission__idx_" ON "submission__test_result_" USING btree ("submission_id_");--> statement-breakpoint
CREATE INDEX "submission__test_result__problem_test__idx_" ON "submission__test_result_" USING btree ("problem_test_id_");--> statement-breakpoint
CREATE UNIQUE INDEX "task__problem__slug__unique_idx_" ON "task__problem_" USING btree ("slug_");--> statement-breakpoint
CREATE INDEX "task__problem_test__problem__idx_" ON "task__problem_test_" USING btree ("problem_id_");