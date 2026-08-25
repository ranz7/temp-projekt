import { ClaimJobRequestDTOZ } from '@backend/modules/submission/contract'
import {
  claimResponse,
  claimSubmission,
  readCheckerRequest
} from '@backend/modules/submission/internal-functions/judging'

/** Hands a worker one waiting submission, or `job: null` when nothing matches it. */
export async function POST(request: Request): Promise<Response> {
  const parsed = await readCheckerRequest(request, ClaimJobRequestDTOZ)

  if (!parsed.ok) return parsed.response

  return claimResponse(await claimSubmission(parsed.payload))
}
