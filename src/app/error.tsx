'use client'

export default function HomeError() {
  return (
    <main className='mx-auto flex min-h-svh w-full max-w-lg flex-col gap-6 p-6'>
      <h1 className='font-semibold text-2xl tracking-tight'>Notes</h1>
      <p className='text-muted'>Nie udało się wczytać notatek.</p>
    </main>
  )
}
