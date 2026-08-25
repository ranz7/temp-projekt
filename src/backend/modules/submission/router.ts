import { createTRPCRouter } from '@backend/trpc'
import { createSubmissionProcedure } from './endpoints/mutations/create-submission'
import { getSubmissionProcedure } from './endpoints/queries/get-submission'
import { listMySubmissionsProcedure } from './endpoints/queries/list-my-submissions'
import { listSubmissionsProcedure } from './endpoints/queries/list-submissions'

export const submissionRouter = createTRPCRouter({
  createSubmission: createSubmissionProcedure,
  getSubmission: getSubmissionProcedure,
  listSubmissions: listSubmissionsProcedure,
  listMySubmissions: listMySubmissionsProcedure
})
