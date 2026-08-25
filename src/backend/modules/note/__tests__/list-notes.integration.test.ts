import { appRouter } from '@backend/appRouter'
import { db } from '@backend/database/db'
import { note__note_ } from '@backend/modules/note/schema'
import { seedNotes } from '@backend/modules/note/seed'
import { createCallerFactory, createTRPCContext } from '@backend/trpc'
import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

const createCaller = createCallerFactory(appRouter)

async function caller() {
  return createCaller(await createTRPCContext({ headers: new Headers() }))
}

describe('note.listNotes', () => {
  it('returns the three seeded notes in created order', async () => {
    await db.delete(note__note_).where(sql`true`)
    await seedNotes()

    const result = await (await caller()).note.listNotes({})

    expect(result.notes.map(note => note.title)).toEqual(['Welcome', 'Vertical slice', 'Homepage'])
    for (const note of result.notes) {
      expect(note.id.length).toBeGreaterThan(0)
      expect(note.body.length).toBeGreaterThan(0)
      expect(note.createdAt).toBeInstanceOf(Date)
    }
  })

  it('returns an empty list after the table is truncated', async () => {
    await db.delete(note__note_).where(sql`true`)

    const result = await (await caller()).note.listNotes({})

    expect(result).toEqual({ notes: [] })
  })
})
