import { uuidv7 } from '@backend/database/sql-functions'
import { type SQL, sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core'

/** Maximum length of a username, mirrored by the login validation. */
export const USERNAME_MAX_LENGTH = 64

/**
 * `lower(column)` as SQL. Used by the username index and by the login lookup,
 * so both agree on what makes two names the same.
 */
export function lower(column: AnyPgColumn): SQL<string> {
  return sql<string>`lower(${column})`
}

export const account__user_ = pgTable(
  'account__user_',
  {
    id: uuid().default(uuidv7).primaryKey().notNull(),
    username_: varchar({ length: USERNAME_MAX_LENGTH }).notNull(),
    created_at_: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  // One account per name whatever the capitals: `Ania` and `ania` are the same person.
  // The name is stored as first typed; only the uniqueness check ignores case.
  table => [uniqueIndex('account__user__username_lower__unique_idx_').on(lower(table.username_))]
)
