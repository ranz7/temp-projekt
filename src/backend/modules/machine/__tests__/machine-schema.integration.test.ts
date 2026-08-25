import { db } from '@backend/database/db'
import { account__user_ } from '@backend/modules/account/schema'
import { machine__machine_ } from '@backend/modules/machine/schema'
import { submission__submission_ } from '@backend/modules/submission/schema'
import { task__problem_ } from '@backend/modules/task/schema'
import { eq, like } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

const NAME_PREFIX = 'itest-machine-'

async function removeTestRows(): Promise<void> {
  await db.delete(machine__machine_).where(like(machine__machine_.name_, `${NAME_PREFIX}%`))
  await db.delete(task__problem_).where(like(task__problem_.slug_, `${NAME_PREFIX}%`))
  await db.delete(account__user_).where(like(account__user_.username_, `${NAME_PREFIX}%`))
}

afterEach(removeTestRows)

describe('machine__machine_', () => {
  it('registers a checking machine with sensible defaults', async () => {
    const [machine] = await db
      .insert(machine__machine_)
      .values({
        name_: `${NAME_PREFIX}01`,
        address_: '10.0.0.11',
        local_port_: 7101
      })
      .returning()

    expect(machine.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(machine.enabled_).toBe(true)
    expect(machine.reachable_).toBe(false)
    expect(machine.capacity_).toBe(0)
    expect(machine.busy_).toBe(0)
    expect(machine.judged_total_).toBe(0)
    expect(machine.problems_).toEqual([])
    expect(machine.version_).toBeNull()
    expect(machine.last_seen_at_).toBeNull()
    expect(machine.last_error_).toBeNull()
  })

  it('refuses a second machine with the same name', async () => {
    await db.insert(machine__machine_).values({
      name_: `${NAME_PREFIX}twin`,
      address_: '10.0.0.12',
      local_port_: 7102
    })

    await expect(
      db.insert(machine__machine_).values({
        name_: `${NAME_PREFIX}twin`,
        address_: '10.0.0.13',
        local_port_: 7103
      })
    ).rejects.toThrow()
  })

  it('keeps a submission when the machine that judged it is removed', async () => {
    const [machine] = await db
      .insert(machine__machine_)
      .values({
        name_: `${NAME_PREFIX}retired`,
        address_: '10.0.0.14',
        local_port_: 7104
      })
      .returning({ id: machine__machine_.id })
    const [problem] = await db
      .insert(task__problem_)
      .values({
        slug_: `${NAME_PREFIX}problem`,
        code_: 'IMA-1',
        title_: 'Itest Machine Problem',
        statement_: 'Anything.',
        difficulty_: 'easy',
        tags_: [],
        languages_: ['python'],
        time_limit_ms_: 1000,
        memory_limit_mb_: 64,
        package_dir_: `${NAME_PREFIX}problem`
      })
      .returning({ id: task__problem_.id })
    const [user] = await db
      .insert(account__user_)
      .values({ username_: `${NAME_PREFIX}author` })
      .returning({ id: account__user_.id })
    const [submission] = await db
      .insert(submission__submission_)
      .values({
        problem_id_: problem.id,
        user_id_: user.id,
        language_: 'python',
        source_code_: 'print(1)',
        status_: 'running',
        machine_id_: machine.id,
        checker_job_id_: 'job-42'
      })
      .returning({ id: submission__submission_.id })

    await db.delete(machine__machine_).where(eq(machine__machine_.id, machine.id))

    const [row] = await db
      .select()
      .from(submission__submission_)
      .where(eq(submission__submission_.id, submission.id))

    expect(row).toBeDefined()
    expect(row.machine_id_).toBeNull()
    expect(row.checker_job_id_).toBe('job-42')
    expect(row.status_).toBe('running')
  })
})
