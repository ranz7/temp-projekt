import { createTRPCRouter } from '@backend/trpc'
import { startBatchProcedure } from './endpoints/mutations/start-batch'
import { stopBatchProcedure } from './endpoints/mutations/stop-batch'
import { getBatchStatusProcedure } from './endpoints/queries/get-batch-status'
import { getThroughputProcedure } from './endpoints/queries/get-throughput'

export const benchmarkRouter = createTRPCRouter({
  startBatch: startBatchProcedure,
  stopBatch: stopBatchProcedure,
  getBatchStatus: getBatchStatusProcedure,
  getThroughput: getThroughputProcedure
})
