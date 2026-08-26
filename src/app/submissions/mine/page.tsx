import { redirect } from 'next/navigation'
import { PageHeader } from '@/app/_components/page-header'
import { getCurrentUser } from '@/app/_hooks/get-current-user'
import { getQueryClient, trpc } from '@/app/_trpc/rsc'
import { PaginationControls } from '../_components/pagination-controls'
import { MySubmissionsTable } from './_components/my-submissions-table'

function parsePage(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

type MySubmissionsPageProps = {
  searchParams: Promise<{ page?: string }>
}

export default async function MySubmissionsPage({ searchParams }: MySubmissionsPageProps) {
  const user = await getCurrentUser()

  // The spec is explicit: an anonymous visitor asking for their own submissions
  // is sent straight to the login page, not shown an empty list.
  if (user === null) {
    redirect('/login')
  }

  const { page: pageParam } = await searchParams
  const page = parsePage(pageParam)

  const data = await getQueryClient().fetchQuery(
    trpc.submission.listMySubmissions.queryOptions({ page })
  )

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='My submissions'
        description='Everything you have submitted, most recent first.'
      />
      <MySubmissionsTable submissions={data.submissions} />
      {data.total > data.pageSize ? (
        <PaginationControls
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          basePath='/submissions/mine'
        />
      ) : null}
    </div>
  )
}
