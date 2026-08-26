import { uuidv7 } from '@backend/database/sql-functions'
import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core'

/** Difficulty buckets a problem package can declare. */
export const PROBLEM_DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export type ProblemDifficulty = (typeof PROBLEM_DIFFICULTIES)[number]

/** Languages a solution may be written in. A problem allows a subset of these. */
export const SUBMISSION_LANGUAGES = ['python', 'cpp'] as const
export type SubmissionLanguage = (typeof SUBMISSION_LANGUAGES)[number]

/** Public tests are samples shown on the problem page; hidden tests score the submission. */
export const TEST_VISIBILITIES = ['public', 'hidden'] as const
export type TestVisibility = (typeof TEST_VISIBILITIES)[number]

/**
 * `token` compares output ignoring whitespace, `custom` runs the package's checker
 * script, and `grader` means the package's own grader is built into the submission
 * and its word is the verdict - nothing is compared against an expected file.
 */
export const CHECKER_TYPES = ['token', 'custom', 'grader'] as const
export type CheckerType = (typeof CHECKER_TYPES)[number]

export const task__problem_ = pgTable(
  'task__problem_',
  {
    id: uuid().default(uuidv7).primaryKey().notNull(),
    slug_: varchar({ length: 128 }).notNull(),
    code_: varchar({ length: 32 }).notNull(),
    title_: varchar({ length: 256 }).notNull(),
    statement_: text().notNull(),
    // The whole statement.md of the package, rendered as Markdown on the problem page.
    statement_markdown_: text(),
    statement_input_: text(),
    statement_output_: text(),
    statement_notes_: text(),
    difficulty_: varchar({ length: 16 }).$type<ProblemDifficulty>().notNull(),
    rating_: integer(),
    tags_: text().array().notNull().default([]),
    kind_: varchar({ length: 32 }).notNull().default('stdio'),
    io_mode_: varchar({ length: 32 }).notNull().default('stdio'),
    languages_: text().array().$type<SubmissionLanguage[]>().notNull(),
    time_limit_ms_: integer().notNull(),
    memory_limit_mb_: integer().notNull(),
    checker_type_: varchar({ length: 16 }).$type<CheckerType>().notNull().default('token'),
    checker_path_: varchar({ length: 512 }),
    package_dir_: varchar({ length: 512 }).notNull(),
    is_published_: boolean().notNull().default(true),
    created_at_: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  table => [uniqueIndex('task__problem__slug__unique_idx_').on(table.slug_)]
)

export const task__problem_test_ = pgTable(
  'task__problem_test_',
  {
    id: uuid().default(uuidv7).primaryKey().notNull(),
    problem_id_: uuid().notNull(),
    ordinal_: integer().notNull(),
    visibility_: varchar({ length: 16 }).$type<TestVisibility>().notNull(),
    input_: text(),
    expected_output_: text(),
    explanation_: text(),
    input_member_: varchar({ length: 512 }),
    output_member_: varchar({ length: 512 }),
    points_: integer().notNull().default(0)
  },
  table => [
    foreignKey({
      columns: [table.problem_id_],
      foreignColumns: [task__problem_.id],
      name: 'task__problem_test__problem__fk_'
    }).onDelete('cascade'),
    index('task__problem_test__problem__idx_').on(table.problem_id_),
    unique('task__problem_test__problem_visibility_ordinal__unique_').on(
      table.problem_id_,
      table.visibility_,
      table.ordinal_
    )
  ]
)
