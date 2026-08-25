import { TRPCClientError } from '@trpc/client'
import { z } from 'zod'

// A failed `input()` validation reaches the client as a JSON-stringified zod
// issue list, not a plain sentence. Unwrap it into readable text; any other
// TRPCError (NOT_FOUND, BAD_REQUEST thrown by hand) already carries one.
const ZodIssueListZ = z.array(z.object({ message: z.string() })).min(1)

export function readableSubmissionError(error: unknown): string {
  if (!(error instanceof TRPCClientError)) {
    return 'Could not submit your solution. Try again.'
  }

  try {
    const issues = ZodIssueListZ.safeParse(JSON.parse(error.message))
    if (issues.success) {
      return issues.data.map(issue => issue.message).join(' ')
    }
  } catch {
    // Not a JSON issue list - fall through to the raw message below.
  }

  return error.message
}
