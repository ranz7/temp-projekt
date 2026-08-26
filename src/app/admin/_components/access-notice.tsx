/**
 * This deployment puts no login in front of `/admin` on purpose - anyone who knows the
 * address can disable machines or send a batch. Say so plainly, so nobody is surprised.
 */
export function AccessNotice() {
  return (
    <p className='rounded-xl bg-tint-amber px-4 py-3 text-sm text-tint-amber-ink ring-1 ring-tint-amber-ring ring-inset'>
      This page controls the judging fleet and is <strong>not access-controlled</strong> - anyone
      who knows this address can disable machines or start a batch.
    </p>
  )
}
