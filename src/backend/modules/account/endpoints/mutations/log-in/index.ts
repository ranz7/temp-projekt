import { setSessionCookie } from '@backend/modules/account/internal-functions/session'
import { account__user_, lower } from '@backend/modules/account/schema'
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
    // Capitals never split an account: `Ania` signs in as the existing `ania`.
    async function findUser(): Promise<User | undefined> {
      const [row] = await ctx.db
        .select(userColumns)
        .from(account__user_)
        .where(eq(lower(account__user_.username_), input.username.toLowerCase()))
        .limit(1)

      return row
    }

    async function createUser(): Promise<User | undefined> {
      // The name is stored as typed. A parallel login for the same name wins the
      // case-insensitive unique index and returns no row.
      const [row] = await ctx.db
        .insert(account__user_)
        .values({ username_: input.username })
        .onConflictDoNothing()
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
