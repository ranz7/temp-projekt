/**
 * This deployment puts no login in front of `/admin` on purpose - anyone who knows the
 * address can disable machines or send a batch. Say so plainly, so nobody is surprised.
 */
export function AccessNotice() {
  return (
    <p className='rounded-xl border border-status-amber/40 bg-status-amber/10 px-4 py-3 text-sm'>
      This page controls the judging fleet and is <strong>not access-controlled</strong> - anyone
      who knows this address can disable machines or start a batch.
    </p>
  )
}
