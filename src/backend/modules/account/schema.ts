import { uuidv7 } from '@backend/database/sql-functions'
import { pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

/** Maximum length of a username, mirrored by the login validation. */
export const USERNAME_MAX_LENGTH = 64

export const account__user_ = pgTable(
  'account__user_',
  {
    id: uuid().default(uuidv7).primaryKey().notNull(),
    username_: varchar({ length: USERNAME_MAX_LENGTH }).notNull(),
    created_at_: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  table => [uniqueIndex('account__user__username__unique_idx_').on(table.username_)]
)
