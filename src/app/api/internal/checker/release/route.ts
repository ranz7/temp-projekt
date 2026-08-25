import { ReleaseJobRequestDTOZ } from '@backend/modules/submission/contract'
import {
  acknowledgementResponse,
  readCheckerRequest,
  releaseSubmissionClaim
} from '@backend/modules/submission/internal-functions/judging'

/** Gives a claim back unjudged, without spending one of the submission's attempts. */
export async function POST(request: Request): Promise<Response> {
  const parsed = await readCheckerRequest(request, ReleaseJobRequestDTOZ)

  if (!parsed.ok) return parsed.response

  await releaseSubmissionClaim(parsed.payload)

  return acknowledgementResponse()
}
