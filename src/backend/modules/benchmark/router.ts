import { createTRPCRouter } from '@backend/trpc'
import { startBatchProcedure } from './endpoints/mutations/start-batch'
import { startScalingRunProcedure } from './endpoints/mutations/start-scaling-run'
import { stopBatchProcedure } from './endpoints/mutations/stop-batch'
import { stopScalingRunProcedure } from './endpoints/mutations/stop-scaling-run'
import { getBatchStatusProcedure } from './endpoints/queries/get-batch-status'
import { getScalingRunProcedure } from './endpoints/queries/get-scaling-run'
import { getThroughputProcedure } from './endpoints/queries/get-throughput'

export const benchmarkRouter = createTRPCRouter({
  startBatch: startBatchProcedure,
  stopBatch: stopBatchProcedure,
  getBatchStatus: getBatchStatusProcedure,
  getThroughput: getThroughputProcedure,
  startScalingRun: startScalingRunProcedure,
  stopScalingRun: stopScalingRunProcedure,
  getScalingRun: getScalingRunProcedure
})
