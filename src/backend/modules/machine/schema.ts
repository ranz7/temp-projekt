import { uuidv7 } from '@backend/database/sql-functions'
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core'

/** Longest machine name the panel accepts, mirrored by the admin input. */
export const MACHINE_NAME_MAX_LENGTH = 64

/**
 * One checking machine. The operator owns `enabled_`; everything else is what the
 * machine last told us when the dispatcher asked it how it was doing.
 */
export const machine__machine_ = pgTable(
  'machine__machine_',
  {
    id: uuid().default(uuidv7).primaryKey().notNull(),
    name_: varchar({ length: MACHINE_NAME_MAX_LENGTH }).notNull(),
    address_: varchar({ length: 255 }).notNull(),
    // The port on the application machine whose SSH tunnel ends at this checker.
    local_port_: integer().notNull(),
    enabled_: boolean().notNull().default(true),
    reachable_: boolean().notNull().default(false),
    capacity_: integer().notNull().default(0),
    busy_: integer().notNull().default(0),
    version_: varchar({ length: 64 }),
    problems_: text().array().notNull().default([]),
    judged_total_: integer().notNull().default(0),
    last_seen_at_: timestamp({ withTimezone: true, mode: 'date' }),
    last_error_: text(),
    created_at_: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  table => [uniqueIndex('machine__machine__name__unique_idx_').on(table.name_)]
)
