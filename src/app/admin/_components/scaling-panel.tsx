'use client'

import type { ScalingRunDTO } from '@backend/modules/benchmark/endpoints/queries/get-scaling-run/output.dto'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Card } from '@/app/_components/card'
import { cn } from '@/app/_components/cn'
import { useTRPC } from '@/app/_trpc/config'
import { formatCount, formatLanguageLabel, formatRate } from '../_lib/format'
import { AnimatedNumber } from './animated-number'
import type { ProblemOption } from './batch-panel'
import { MachineLamps } from './machine-lamps'
import { readableBatchError } from './readable-batch-error'
import { ScalingChart } from './scaling-chart'
import { ScalingStepsTable } from './scaling-steps-table'

const DEFAULT_PER_STEP = 20

type ScalingPanelProps = {
  run: ScalingRunDTO | null
  problems: ProblemOption[]
  /** Machines answering right now - the most rungs a new run could climb. */
  machinesAnswering: number
}

/**
 * What another machine actually buys. The run sends the same pile of correct
 * solutions to one machine, then two, and so on up the fleet, and draws the answer
 * while it happens.
 */
export function ScalingPanel({ run, problems, machinesAnswering }: ScalingPanelProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [problemSlug, setProblemSlug] = useState(problems[0]?.slug ?? '')
  const [perStep, setPerStep] = useState(DEFAULT_PER_STEP)

  const runKey = trpc.benchmark.getScalingRun.queryKey()

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: runKey })
  }

  const startMutation = useMutation(
    trpc.benchmark.startScalingRun.mutationOptions({ onSuccess: refresh })
  )
  const stopMutation = useMutation(
    trpc.benchmark.stopScalingRun.mutationOptions({ onSuccess: refresh })
  )

  const isRunning = run?.status === 'running'
  const error = startMutation.isError
    ? readableBatchError(startMutation.error)
    : stopMutation.isError
      ? readableBatchError(stopMutation.error)
      : (run?.error ?? null)

  const measured = run?.steps.filter(step => step.perMinute !== null) ?? []
  const latest = measured.at(-1) ?? null
  const first = measured.find(step => step.machineCount === 1)?.perMinute ?? null
  const speedUp = first === null || latest?.perMinute == null ? null : latest.perMinute / first
  const current = run?.steps.find(step => step.machineCount === run.currentMachineCount) ?? null

  return (
    <Card
      title='What another machine buys'
      subtitle='The same pile of correct solutions, sent to one machine, then two, then the whole fleet.'
      bodyClassName='flex flex-col'
    >
      {run !== null ? (
        <div className='flex flex-col gap-5 border-divider border-b p-4 sm:p-5'>
          <div className='flex flex-wrap items-end justify-between gap-6'>
            <div className='flex flex-col gap-1'>
              <p className='text-muted text-xs uppercase tracking-wide'>
                {isRunning ? 'Measuring now' : 'Best measured'}
              </p>
              <p className='font-bold text-4xl text-foreground tabular-nums sm:text-5xl'>
                <AnimatedNumber value={latest?.perMinute ?? 0} format={formatRate} />
                <span className='ml-2 font-normal text-base text-muted sm:text-lg'>
                  solutions / minute
                </span>
              </p>
              <p className='text-muted text-sm'>
                with{' '}
                <span className='font-medium text-foreground tabular-nums'>
                  {latest?.machineCount ?? 0}
                </span>{' '}
                {latest?.machineCount === 1 ? 'machine' : 'machines'} working, judging{' '}
                {run.problemTitle} in {formatLanguageLabel(run.language)}
              </p>
            </div>

            <div className='flex flex-wrap gap-8'>
              {speedUp !== null ? (
                <div className='flex flex-col gap-1'>
                  <p className='text-muted text-xs uppercase tracking-wide'>Against one machine</p>
                  <p className='font-bold text-3xl text-status-green tabular-nums sm:text-4xl'>
                    x<AnimatedNumber value={speedUp} format={value => value.toFixed(2)} />
                  </p>
                </div>
              ) : null}

              {/* Whether the machines are actually busy says, better than the curve
                  alone, whether another machine would buy anything at all. */}
              {latest?.slotsBusy != null && latest.slotsTotal != null ? (
                <div className='flex flex-col gap-1'>
                  <p className='text-muted text-xs uppercase tracking-wide'>Judged at once</p>
                  <p className='font-bold text-3xl text-foreground tabular-nums sm:text-4xl'>
                    <AnimatedNumber value={latest.slotsBusy} format={formatRate} />
                    <span className='font-normal text-base text-muted sm:text-lg'>
                      {' '}
                      of {latest.slotsTotal} slots
                    </span>
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className='flex flex-col gap-2'>
            <MachineLamps
              total={run.maxMachines}
              lit={run.currentMachineCount ?? latest?.machineCount ?? 0}
              isClimbing={isRunning}
            />
            {isRunning && current !== null ? (
              <div className='flex flex-col gap-1'>
                <div className='h-1.5 w-full overflow-hidden rounded-full bg-placeholder'>
                  <div
                    className='h-full rounded-full bg-status-amber transition-all duration-500'
                    style={{
                      width: `${Math.round((current.finished / Math.max(current.requested, 1)) * 100)}%`
                    }}
                  />
                </div>
                <p className='text-muted text-xs tabular-nums'>
                  {formatCount(current.finished)} of {formatCount(current.requested)} judged on{' '}
                  {current.machineCount} {current.machineCount === 1 ? 'machine' : 'machines'}
                </p>
              </div>
            ) : null}
          </div>

          <ScalingChart
            steps={run.steps}
            currentMachineCount={run.currentMachineCount}
            maxMachines={run.maxMachines}
          />
        </div>
      ) : null}

      <div className='flex flex-wrap items-end gap-3 p-4 sm:p-5'>
        {isRunning ? (
          <button
            type='button'
            onClick={() => stopMutation.mutate({})}
            disabled={stopMutation.isPending}
            className='btn-secondary border-danger text-danger'
          >
            {stopMutation.isPending ? 'Stopping...' : 'Stop measuring'}
          </button>
        ) : (
          <>
            <label className='flex min-w-48 flex-col gap-1 font-medium text-muted text-xs'>
              Problem
              <select
                value={problemSlug}
                onChange={event => setProblemSlug(event.target.value)}
                className='field'
              >
                {problems.map(problem => (
                  <option key={problem.slug} value={problem.slug}>
                    {problem.code} - {problem.title}
                  </option>
                ))}
              </select>
            </label>

            <label className='flex flex-col gap-1 font-medium text-muted text-xs'>
              Solutions per step
              <input
                type='number'
                min={1}
                max={200}
                value={perStep}
                onChange={event => setPerStep(Number(event.target.value))}
                className='field w-32'
              />
            </label>

            <button
              type='button'
              onClick={() => startMutation.mutate({ problemSlug, submissionsPerStep: perStep })}
              disabled={
                startMutation.isPending ||
                problemSlug === '' ||
                perStep < 1 ||
                machinesAnswering === 0
              }
              className='btn-primary'
            >
              {startMutation.isPending ? 'Starting...' : 'Measure scaling'}
            </button>

            <p className={cn('text-muted text-xs', machinesAnswering === 0 && 'text-danger')}>
              {machinesAnswering === 0
                ? 'No machine is answering, so there is nothing to measure.'
                : `Climbs from 1 to ${machinesAnswering} ${machinesAnswering === 1 ? 'machine' : 'machines'}.`}
            </p>
          </>
        )}
      </div>

      {error !== null ? (
        <p role='alert' className='border-divider border-t px-4 py-3 text-danger text-sm sm:px-5'>
          {error}
        </p>
      ) : null}

      {run !== null && run.steps.length > 0 ? (
        <div className='border-divider border-t'>
          <ScalingStepsTable steps={run.steps} currentMachineCount={run.currentMachineCount} />
        </div>
      ) : null}
    </Card>
  )
}
