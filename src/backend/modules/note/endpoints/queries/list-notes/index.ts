import { note__note_ } from '@backend/modules/note/schema'
import { publicProcedure } from '@backend/trpc'
import { asc } from 'drizzle-orm'
import { ListNotesInputDTOZ } from './input.dto'
import { ListNotesOutputDTOZ } from './output.dto'

export const listNotesProcedure = publicProcedure
  .meta({ operation: 'note.listNotes', procedureKind: 'query' })
  .input(ListNotesInputDTOZ)
  .output(ListNotesOutputDTOZ)
  .query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: note__note_.id,
        title: note__note_.title_,
        body: note__note_.body_,
        createdAt: note__note_.created_at_
      })
      .from(note__note_)
      .orderBy(asc(note__note_.created_at_))

    return { notes: rows }
  })
