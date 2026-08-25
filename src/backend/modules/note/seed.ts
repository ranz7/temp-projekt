import { db } from '@backend/database/db'
import { note__note_ } from '@backend/modules/note/schema'

const SEEDED_NOTES = [
  {
    title_: 'Welcome',
    body_: 'This skeleton lists notes from Postgres through tRPC.'
  },
  {
    title_: 'Vertical slice',
    body_: 'The note module owns its schema, router, and listNotes query.'
  },
  {
    title_: 'Homepage',
    body_: 'The App Router page prefetches listNotes and renders one card per row.'
  }
] as const

/**
 * Idempotent: if the table has any row, it inserts nothing.
 */
export async function seedNotes() {
  const existing = await db.select({ id: note__note_.id }).from(note__note_).limit(1)
  if (existing.length > 0) {
    return
  }

  await db.insert(note__note_).values([...SEEDED_NOTES])
}
