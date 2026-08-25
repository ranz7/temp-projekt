import { createTRPCRouter } from '@backend/trpc'
import { listNotesProcedure } from './endpoints/queries/list-notes'

export const noteRouter = createTRPCRouter({
  listNotes: listNotesProcedure
})
