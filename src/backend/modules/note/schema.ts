import { uuidv7 } from '@backend/database/sql-functions'
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const note__note_ = pgTable('note__note_', {
  id: uuid().default(uuidv7).primaryKey().notNull(),
  title_: text().notNull(),
  body_: text().notNull(),
  created_at_: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow()
})
