import { z } from 'zod'

export const ListNotesNoteDTOZ = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string(),
  createdAt: z.date()
})

export const ListNotesOutputDTOZ = z.object({
  notes: z.array(ListNotesNoteDTOZ)
})

export type ListNotesOutputDTO = z.infer<typeof ListNotesOutputDTOZ>
