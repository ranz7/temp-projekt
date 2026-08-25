import { NotesListSkeleton } from './_components/notes-list-skeleton'

export default function HomeLoading() {
  return (
    <main className='mx-auto flex min-h-svh w-full max-w-lg flex-col gap-6 p-6'>
      <h1 className='font-semibold text-2xl tracking-tight'>Notes</h1>
      <NotesListSkeleton />
    </main>
  )
}
