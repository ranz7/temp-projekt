import { PageHeader } from '@/app/_components/page-header'
import { getCurrentUser } from '@/app/_hooks/get-current-user'
import { getQueryClient, trpc } from '@/app/_trpc/rsc'
import { PaginationControls } from './_components/pagination-controls'
import { SubmissionsTable } from './_components/submissions-table'

function parsePage(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

type SubmissionsPageProps = {
  searchParams: Promise<{ page?: string }>
}

export default async function SubmissionsPage({ searchParams }: SubmissionsPageProps) {
  const { page: pageParam } = await searchParams
  const page = parsePage(pageParam)
  const user = await getCurrentUser()

  const data = await getQueryClient().fetchQuery(
    trpc.submission.listSubmissions.queryOptions({ page })
  )

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader title='Submissions' description='The newest activity from everyone.' />
      <SubmissionsTable submissions={data.submissions} currentUsername={user?.username ?? null} />
      {data.total > data.pageSize ? (
        <PaginationControls
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          basePath='/submissions'
        />
      ) : null}
    </div>
  )
}
