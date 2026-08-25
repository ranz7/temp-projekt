'use client'

import type { BatchStatusDTO } from '@backend/modules/benchmark/endpoints/queries/get-batch-status/output.dto'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Card } from '@/app/_components/card'
import { useTRPC } from '@/app/_trpc/config'
import { formatCount, formatLanguageLabel } from '../_lib/format'
import { readableBatchError } from './readable-batch-error'
import { VerdictList } from './verdict-list'

// Mirrors BENCHMARK_BATCH_MAX_SUBMISSIONS in the backend schema - kept local so this
// client component never has to pull in the Drizzle table definitions to read one number.
const BATCH_MAX_SUBMISSIONS = 500
const BATCH_DEFAULT_COUNT = 50

export type ProblemOption = {
  slug: string
  code: string
  title: string
}

type BatchPanelProps = {
  batch: BatchStatusDTO | null
  problems: ProblemOption[]
}

const CONTROL_CLASS =
  'rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent'

/**
 * Sends a batch of shipped solutions against a problem, and shows the running batch's
 * verdicts as they land. Only one batch runs at a time - the form gives way to the live
 * status while one is running.
 */
export function BatchPanel({ batch, problems }: BatchPanelProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const statusKey = trpc.benchmark.getBatchStatus.queryKey()

  const [problemSlug, setProblemSlug] = useState(problems[0]?.slug ?? '')
  const [count, setCount] = useState(BATCH_DEFAULT_COUNT)

  const startBatchMutation = useMutation(
    trpc.benchmark.startBatch.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: statusKey })
      }
    })
  )

  const stopBatchMutation = useMutation(
    trpc.benchmark.stopBatch.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: statusKey })
      }
    })
  )

  const isRunning = batch?.status === 'running'
  const error = startBatchMutation.isError
    ? readableBatchError(startBatchMutation.error)
    : stopBatchMutation.isError
      ? readableBatchError(stopBatchMutation.error)
      : null

  if (isRunning && batch !== null) {
    return (
      <Card>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex flex-col gap-0.5'>
            <h2 className='font-semibold text-sm'>Batch running</h2>
            <p className='text-muted text-sm'>
              {batch.problemTitle} - {formatLanguageLabel(batch.language)}
            </p>
          </div>
          <button
            type='button'
            onClick={() => stopBatchMutation.mutate({})}
            disabled={stopBatchMutation.isPending}
            className='rounded-lg border border-danger px-3 py-1.5 font-medium text-danger text-sm disabled:opacity-60'
          >
            {stopBatchMutation.isPending ? 'Stopping…' : 'Stop batch'}
          </button>
        </div>

        <div className='flex flex-wrap gap-6 text-sm'>
          <span className='tabular-nums'>
            <span className='text-muted'>Sent </span>
            {formatCount(batch.createdCount)} / {formatCount(batch.requestedCount)}
          </span>
          <span className='tabular-nums'>
            <span className='text-muted'>Finished </span>
            {formatCount(batch.finishedCount)}
          </span>
          <span className='tabular-nums'>
            <span className='text-muted'>Pending </span>
            {formatCount(batch.pendingCount)}
          </span>
        </div>

        <VerdictList verdicts={batch.verdicts} />

        {error !== null ? (
          <p role='alert' className='text-danger text-sm'>
            {error}
          </p>
        ) : null}
      </Card>
    )
  }

  return (
    <Card>
      <div className='flex flex-col gap-0.5'>
        <h2 className='font-semibold text-sm'>Send a batch</h2>
        <p className='text-muted text-sm'>
          Sends a mixture of correct and deliberately wrong solutions, about seven in ten correct,
          as the built-in <code>benchmark</code> account.
        </p>
      </div>

      {batch !== null && batch.status !== 'running' ? (
        <div className='flex flex-col gap-2 rounded-lg border border-border p-3'>
          <p className='text-muted text-xs uppercase tracking-wide'>
            Last batch - {batch.problemTitle} ({batch.status})
          </p>
          <VerdictList verdicts={batch.verdicts} />
          {batch.error !== null ? <p className='text-danger text-sm'>{batch.error}</p> : null}
        </div>
      ) : null}

      {problems.length === 0 ? (
        <p className='text-muted text-sm'>No problems are available to send a batch against.</p>
      ) : (
        <div className='flex flex-wrap items-end gap-3'>
          <label className='flex min-w-48 flex-col gap-1.5'>
            <span className='font-medium text-muted text-xs'>Problem</span>
            <select
              value={problemSlug}
              onChange={event => setProblemSlug(event.target.value)}
              className={CONTROL_CLASS}
            >
              {problems.map(problem => (
                <option key={problem.slug} value={problem.slug}>
                  {problem.code} - {problem.title}
                </option>
              ))}
            </select>
          </label>

          <label className='flex flex-col gap-1.5'>
            <span className='font-medium text-muted text-xs'>Submissions</span>
            <input
              type='number'
              min={1}
              max={BATCH_MAX_SUBMISSIONS}
              value={count}
              onChange={event => setCount(Number(event.target.value))}
              className={`${CONTROL_CLASS} w-28`}
            />
          </label>

          <button
            type='button'
            onClick={() => startBatchMutation.mutate({ problemSlug, count })}
            disabled={
              startBatchMutation.isPending ||
              problemSlug === '' ||
              count < 1 ||
              count > BATCH_MAX_SUBMISSIONS
            }
            className='rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground text-sm disabled:opacity-60'
          >
            {startBatchMutation.isPending ? 'Starting…' : 'Start batch'}
          </button>
        </div>
      )}

      {error !== null ? (
        <p role='alert' className='text-danger text-sm'>
          {error}
        </p>
      ) : null}
    </Card>
  )
}
