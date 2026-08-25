import type { Database } from '@backend/database/db'
import { account__user_ } from '@backend/modules/account/schema'
import { type SubmissionStatus, submission__submission_ } from '@backend/modules/submission/schema'
import { type SubmissionLanguage, task__problem_ } from '@backend/modules/task/schema'
import { and, count, desc, eq, type SQL } from 'drizzle-orm'

export type SubmissionListFilter = {
  /** Only this problem's submissions. */
  problemSlug?: string
  /** Only this person's submissions. */
  userId?: string
}

export type SubmissionListPaging = {
  page: number
  pageSize: number
}

export type SubmissionListRow = {
  id: string
  problemSlug: string
  problemCode: string
  problemTitle: string
  username: string
  language: SubmissionLanguage
  status: SubmissionStatus
  createdAt: Date
  score: number | null
  maxScore: number | null
}

export type SubmissionListPageResult = {
  rows: SubmissionListRow[]
  total: number
}

function buildFilter(filter: SubmissionListFilter): SQL | undefined {
  const conditions: SQL[] = []

  if (filter.problemSlug !== undefined) {
    conditions.push(eq(task__problem_.slug_, filter.problemSlug))
  }

  if (filter.userId !== undefined) {
    conditions.push(eq(submission__submission_.user_id_, filter.userId))
  }

  return conditions.length > 0 ? and(...conditions) : undefined
}

/**
 * One page of submissions, newest first. Both list endpoints read through here;
 * each decides which of these columns its own output carries.
 */
export async function findSubmissionPage(
  database: Database,
  filter: SubmissionListFilter,
  paging: SubmissionListPaging
): Promise<SubmissionListPageResult> {
  const where = buildFilter(filter)

  const rows = await database
    .select({
      id: submission__submission_.id,
      problemSlug: task__problem_.slug_,
      problemCode: task__problem_.code_,
      problemTitle: task__problem_.title_,
      username: account__user_.username_,
      language: submission__submission_.language_,
      status: submission__submission_.status_,
      createdAt: submission__submission_.created_at_,
      score: submission__submission_.score_,
      maxScore: submission__submission_.max_score_
    })
    .from(submission__submission_)
    .innerJoin(task__problem_, eq(task__problem_.id, submission__submission_.problem_id_))
    .innerJoin(account__user_, eq(account__user_.id, submission__submission_.user_id_))
    .where(where)
    // Ids are time ordered, so they settle submissions made in the same instant.
    .orderBy(desc(submission__submission_.created_at_), desc(submission__submission_.id))
    .limit(paging.pageSize)
    .offset((paging.page - 1) * paging.pageSize)

  const [totals] = await database
    .select({ total: count() })
    .from(submission__submission_)
    .innerJoin(task__problem_, eq(task__problem_.id, submission__submission_.problem_id_))
    .innerJoin(account__user_, eq(account__user_.id, submission__submission_.user_id_))
    .where(where)

  return { rows, total: totals?.total ?? 0 }
}
