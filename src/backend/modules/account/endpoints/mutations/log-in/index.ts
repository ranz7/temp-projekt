import { setSessionCookie } from '@backend/modules/account/internal-functions/session'
import { account__user_ } from '@backend/modules/account/schema'
import { publicProcedure } from '@backend/trpc'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { LogInInputDTOZ } from './input.dto'
import { LogInOutputDTOZ } from './output.dto'

const userColumns = {
  id: account__user_.id,
  username: account__user_.username_,
  createdAt: account__user_.created_at_
}

type User = { id: string; username: string; createdAt: Date }

export const logInProcedure = publicProcedure
  .meta({ operation: 'account.logIn', procedureKind: 'mutation' })
  .input(LogInInputDTOZ)
  .output(LogInOutputDTOZ)
  .mutation(async ({ ctx, input }) => {
    async function findUser(): Promise<User | undefined> {
      const [row] = await ctx.db
        .select(userColumns)
        .from(account__user_)
        .where(eq(account__user_.username_, input.username))
        .limit(1)

      return row
    }

    async function createUser(): Promise<User | undefined> {
      // A parallel login for the same name wins the unique index and returns no row.
      const [row] = await ctx.db
        .insert(account__user_)
        .values({ username_: input.username })
        .onConflictDoNothing({ target: account__user_.username_ })
        .returning(userColumns)

      return row
    }

    const user = (await findUser()) ?? (await createUser()) ?? (await findUser())

    if (!user) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not sign you in.' })
    }

    setSessionCookie(ctx.resHeaders, user.id)

    return user
  })
