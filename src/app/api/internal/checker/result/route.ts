import { ResultRequestDTOZ } from '@backend/modules/submission/contract'
import {
  acknowledgementResponse,
  applySubmissionResult,
  readCheckerRequest
} from '@backend/modules/submission/internal-functions/judging'

/** Takes a progress report or the final verdict of the active claim. */
export async function POST(request: Request): Promise<Response> {
  const parsed = await readCheckerRequest(request, ResultRequestDTOZ)

  if (!parsed.ok) return parsed.response

  await applySubmissionResult(parsed.payload)

  return acknowledgementResponse()
}
