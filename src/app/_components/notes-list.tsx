'use client'

import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/app/_trpc/config'
import { NoteCard } from './note-card'

export function NotesList() {
  const trpc = useTRPC()
  const notesQuery = useQuery(trpc.note.listNotes.queryOptions({}))
  const notes = notesQuery.data?.notes ?? []

  if (notes.length === 0) {
    return <p className='text-muted'>Brak notatek</p>
  }

  return (
    <ul className='flex flex-col gap-3'>
      {notes.map(note => (
        <li key={note.id}>
          <NoteCard title={note.title} body={note.body} />
        </li>
      ))}
    </ul>
  )
}
