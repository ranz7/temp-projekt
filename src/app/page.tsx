import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { getQueryClient, prefetchAwaited, trpc } from '@/app/_trpc/rsc'
import { NotesList } from './_components/notes-list'

export default async function HomePage() {
  await prefetchAwaited(trpc.note.listNotes.queryOptions({}))

  return (
    <main className='mx-auto flex min-h-svh w-full max-w-lg flex-col gap-6 p-6'>
      <h1 className='font-semibold text-2xl tracking-tight'>Notes</h1>
      <HydrationBoundary state={dehydrate(getQueryClient())}>
        <NotesList />
      </HydrationBoundary>
    </main>
  )
}
