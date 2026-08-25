import { uuidv7 } from '@backend/database/sql-functions'
import { submission__submission_ } from '@backend/modules/submission/schema'
import { type SubmissionLanguage, task__problem_ } from '@backend/modules/task/schema'
import { sql } from 'drizzle-orm'
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

/**
 * Where a batch got to. `running` is the only state that still creates
 * submissions; the other three are the ways it can end.
 */
export const BENCHMARK_BATCH_STATUSES = ['running', 'completed', 'stopped', 'failed'] as const
export type BenchmarkBatchStatus = (typeof BENCHMARK_BATCH_STATUSES)[number]

/** The largest batch the panel may ask for. */
export const BENCHMARK_BATCH_MAX_SUBMISSIONS = 500

/** One press of the panel's "send a batch of solutions" button. */
export const benchmark__batch_ = pgTable(
  'benchmark__batch_',
  {
    id: uuid().default(uuidv7).primaryKey().notNull(),
    problem_id_: uuid().notNull(),
    language_: varchar({ length: 32 }).$type<SubmissionLanguage>().notNull(),
    requested_count_: integer().notNull(),
    // How many submissions have actually been created so far. A stopped batch keeps
    // whatever it reached.
    created_count_: integer().notNull().default(0),
    status_: varchar({ length: 16 }).$type<BenchmarkBatchStatus>().notNull().default('running'),
    last_error_: text(),
    started_at_: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    ended_at_: timestamp({ withTimezone: true, mode: 'date' })
  },
  table => [
    foreignKey({
      columns: [table.problem_id_],
      foreignColumns: [task__problem_.id],
      name: 'benchmark__batch__problem__fk_'
    }).onDelete('cascade'),
    index('benchmark__batch__started__idx_').on(table.started_at_),
    // Only one batch runs at a time. Every running row carries the same status, so a
    // unique index over just those rows lets Postgres, not a read-then-write, be the
    // one that says no.
    uniqueIndex('benchmark__batch__single_running__unique_idx_')
      .on(table.status_)
      .where(sql`${table.status_} = 'running'`)
  ]
)

/**
 * Which submissions a batch sent, and whether it sent the correct solution or the
 * deliberately wrong one. The submission itself is an ordinary submission by the
 * `benchmark` account and knows nothing about the batch.
 */
export const benchmark__batch_submission_ = pgTable(
  'benchmark__batch_submission_',
  {
    id: uuid().default(uuidv7).primaryKey().notNull(),
    batch_id_: uuid().notNull(),
    submission_id_: uuid().notNull(),
    /** True when the correct reference solution was sent. */
    expects_accepted_: boolean().notNull(),
    created_at_: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  table => [
    foreignKey({
      columns: [table.batch_id_],
      foreignColumns: [benchmark__batch_.id],
      name: 'benchmark__batch_submission__batch__fk_'
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.submission_id_],
      foreignColumns: [submission__submission_.id],
      name: 'benchmark__batch_submission__submission__fk_'
    }).onDelete('cascade'),
    index('benchmark__batch_submission__batch__idx_').on(table.batch_id_),
    unique('benchmark__batch_submission__submission__unique_').on(table.submission_id_)
  ]
)
