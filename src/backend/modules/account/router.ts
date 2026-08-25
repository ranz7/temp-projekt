import { createTRPCRouter } from '@backend/trpc'
import { logInProcedure } from './endpoints/mutations/log-in'
import { logOutProcedure } from './endpoints/mutations/log-out'
import { getCurrentUserProcedure } from './endpoints/queries/get-current-user'

export const accountRouter = createTRPCRouter({
  logIn: logInProcedure,
  logOut: logOutProcedure,
  getCurrentUser: getCurrentUserProcedure
})
