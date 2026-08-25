import { PageHeader } from './_components/page-header'

export default function HomePage() {
  return (
    <main className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-6'>
      <PageHeader
        title='Problems'
        description='The problem list and recent activity are coming soon.'
      />
    </main>
  )
}
