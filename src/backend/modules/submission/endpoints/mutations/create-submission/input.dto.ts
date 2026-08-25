import { z } from 'zod'

/** A solution may weigh at most 2 MB, the same limit the editor's file picker enforces. */
export const SOURCE_CODE_MAX_BYTES = 2 * 1024 * 1024

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

export const CreateSubmissionInputDTOZ = z.object({
  problemSlug: z.string().min(1, 'Choose a problem.').max(128),
  // Any name is accepted here so that the endpoint - not the parser - answers an
  // unsupported language with a sentence a person can read.
  language: z.string().min(1, 'Choose a language.').max(32),
  sourceCode: z
    .string()
    .min(1, 'Write your solution before submitting it.')
    .refine(value => byteLength(value) <= SOURCE_CODE_MAX_BYTES, 'A solution may be at most 2 MB.')
})

export type CreateSubmissionInputDTO = z.infer<typeof CreateSubmissionInputDTOZ>
