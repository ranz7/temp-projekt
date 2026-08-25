import { z } from 'zod'

export const ListNotesInputDTOZ = z.object({})

export type ListNotesInputDTO = z.infer<typeof ListNotesInputDTOZ>
