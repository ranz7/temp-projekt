import { clearSessionCookie } from '@backend/modules/account/internal-functions/session'
import { publicProcedure } from '@backend/trpc'
import { LogOutInputDTOZ } from './input.dto'
import { LogOutOutputDTOZ } from './output.dto'

export const logOutProcedure = publicProcedure
  .meta({ operation: 'account.logOut', procedureKind: 'mutation' })
  .input(LogOutInputDTOZ)
  .output(LogOutOutputDTOZ)
  .mutation(({ ctx }) => {
    clearSessionCookie(ctx.resHeaders)

    return { loggedOut: true }
  })
