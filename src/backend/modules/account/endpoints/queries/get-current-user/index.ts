import { account__user_ } from '@backend/modules/account/schema'
import { publicProcedure } from '@backend/trpc'
import { eq } from 'drizzle-orm'
import { GetCurrentUserInputDTOZ } from './input.dto'
import { GetCurrentUserOutputDTOZ } from './output.dto'

export const getCurrentUserProcedure = publicProcedure
  .meta({ operation: 'account.getCurrentUser', procedureKind: 'query' })
  .input(GetCurrentUserInputDTOZ)
  .output(GetCurrentUserOutputDTOZ)
  .query(async ({ ctx }) => {
    if (ctx.userId === null) return null

    const [user] = await ctx.db
      .select({
        id: account__user_.id,
        username: account__user_.username_,
        createdAt: account__user_.created_at_
      })
      .from(account__user_)
      .where(eq(account__user_.id, ctx.userId))
      .limit(1)

    return user ?? null
  })
