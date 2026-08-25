/**
 * Liveness: 200 for as long as the process answers at all.
 *
 * A container healthcheck hits this every few seconds, so it touches nothing -
 * no database, no Redis. A failing dependency must not restart a healthy process.
 */
export const dynamic = 'force-dynamic'

export function GET(): Response {
  return Response.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) })
}
