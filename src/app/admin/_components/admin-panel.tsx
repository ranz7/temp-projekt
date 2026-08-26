'use client'

import { useQuery } from '@tanstack/react-query'
import { ErrorState } from '@/app/_components/error-state'
import { useTRPC } from '@/app/_trpc/config'
import { BatchPanel, type ProblemOption } from './batch-panel'
import { FleetSummary } from './fleet-summary'
import { MachineTable } from './machine-table'
import { ScalingPanel } from './scaling-panel'
import { ThroughputChart } from './throughput-chart'
import { useIsTabVisible } from './use-is-tab-visible'

/** While a batch is running, the panel refreshes about once a second. */
const FAST_POLL_MS = 1000
/** Otherwise it settles down to something calm. */
const CALM_POLL_MS = 8000

type AdminPanelProps = {
  problems: ProblemOption[]
}

/**
 * Owns the panel's three live reads - machines, the batch, throughput - and their
 * shared polling cadence: fast while a batch runs, calm otherwise, off whenever the tab
 * is hidden. Everything below just renders what it is given.
 */
export function AdminPanel({ problems }: AdminPanelProps) {
  const trpc = useTRPC()
  const isVisible = useIsTabVisible()

  const batchQuery = useQuery({
    ...trpc.benchmark.getBatchStatus.queryOptions(),
    refetchInterval: query =>
      isVisible
        ? query.state.data?.batch?.status === 'running'
          ? FAST_POLL_MS
          : CALM_POLL_MS
        : false
  })

  const isBatchRunning = batchQuery.data?.batch?.status === 'running'
  const sharedRefetchInterval = isVisible ? (isBatchRunning ? FAST_POLL_MS : CALM_POLL_MS) : false

  const machinesQuery = useQuery({
    ...trpc.machine.listMachines.queryOptions(),
    refetchInterval: sharedRefetchInterval
  })

  const throughputQuery = useQuery({
    ...trpc.benchmark.getThroughput.queryOptions(),
    refetchInterval: sharedRefetchInterval
  })

  const scalingQuery = useQuery({
    ...trpc.benchmark.getScalingRun.queryOptions(),
    // A run climbs a rung at a time, so the panel watches it closely while it goes.
    refetchInterval: query =>
      isVisible
        ? query.state.data?.run?.status === 'running'
          ? FAST_POLL_MS
          : CALM_POLL_MS
        : false
  })

  if (machinesQuery.isError || throughputQuery.isError || batchQuery.isError) {
    return <ErrorState description='The panel could not load its data. Try refreshing.' />
  }

  const machines = machinesQuery.data?.machines ?? []

  return (
    <div className='flex min-w-0 flex-col gap-6'>
      <FleetSummary machines={machines} />

      <ScalingPanel
        run={scalingQuery.data?.run ?? null}
        problems={problems}
        machinesAnswering={machines.filter(machine => machine.reachable).length}
      />

      {throughputQuery.data !== undefined ? (
        <ThroughputChart throughput={throughputQuery.data} />
      ) : null}

      <BatchPanel batch={batchQuery.data?.batch ?? null} problems={problems} />

      <MachineTable machines={machines} />
    </div>
  )
}
