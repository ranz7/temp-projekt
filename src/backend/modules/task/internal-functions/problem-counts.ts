import { submission__submission_ } from '@backend/modules/submission/schema'
import { task__problem_, task__problem_test_ } from '@backend/modules/task/schema'
import { type Column, getTableName, type SQL, sql } from 'drizzle-orm'

/**
 * `"table"."column"`. A select over a single table writes column names bare, and
 * a correlated subquery then reads `id` as its own row rather than the problem's.
 */
function qualified(column: Column): SQL {
  return sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`
}

/**
 * How many distinct people have an accepted solution for the problem of the
 * surrounding query. Postgres both returns the number and can sort by it, so
 * the list never counts in JavaScript.
 *
 * Read-only use of the submission module's table; nothing here writes to it.
 */
export function solveCountSql(): SQL<number> {
  return sql<number>`(
    select count(distinct ${qualified(submission__submission_.user_id_)})
    from ${submission__submission_}
    where ${qualified(submission__submission_.problem_id_)} = ${qualified(task__problem_.id)}
      and ${qualified(submission__submission_.status_)} = 'accepted'
  )`.mapWith(Number)
}

/** How many hidden tests a problem has. The count is all a visitor ever learns about them. */
export function hiddenTestCountSql(): SQL<number> {
  return sql<number>`(
    select count(*)
    from ${task__problem_test_}
    where ${qualified(task__problem_test_.problem_id_)} = ${qualified(task__problem_.id)}
      and ${qualified(task__problem_test_.visibility_)} = 'hidden'
  )`.mapWith(Number)
}
