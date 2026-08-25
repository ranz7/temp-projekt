export function NoteCard({ title, body }: { title: string; body: string }) {
  return (
    <article className='flex flex-col gap-2 rounded-xl border border-border bg-card p-4'>
      <h2 className='font-semibold text-lg tracking-tight'>{title}</h2>
      <p className='text-muted text-sm'>{body}</p>
    </article>
  )
}
