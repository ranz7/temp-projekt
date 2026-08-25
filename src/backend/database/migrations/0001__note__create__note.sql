CREATE TABLE "note__note_" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"title_" text NOT NULL,
	"body_" text NOT NULL,
	"created_at_" timestamp with time zone DEFAULT now() NOT NULL
);
