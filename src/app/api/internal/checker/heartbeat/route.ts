import { HeartbeatJobRequestDTOZ } from '@backend/modules/submission/contract'
import {
  acknowledgementResponse,
  extendClaimLease,
  readCheckerRequest
} from '@backend/modules/submission/internal-functions/judging'

/** Keeps a claim alive. A claim that is no longer the active one changes nothing. */
export async function POST(request: Request): Promise<Response> {
  const parsed = await readCheckerRequest(request, HeartbeatJobRequestDTOZ)

  if (!parsed.ok) return parsed.response

  await extendClaimLease(parsed.payload)

  return acknowledgementResponse()
}
