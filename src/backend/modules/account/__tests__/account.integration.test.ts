import { appRouter } from '@backend/appRouter'
import { db } from '@backend/database/db'
import {
  SESSION_COOKIE_NAME,
  signSession
} from '@backend/modules/account/internal-functions/session'
import { account__user_ } from '@backend/modules/account/schema'
import { createCallerFactory, createTRPCContext } from '@backend/trpc'
import { eq, like } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const createCaller = createCallerFactory(appRouter)

const usernamePrefix = 'itest-account-'

async function caller(cookieHeader?: string) {
  const headers = new Headers()
  if (cookieHeader) headers.set('cookie', cookieHeader)
  const resHeaders = new Headers()

  return {
    trpc: createCaller(await createTRPCContext({ headers, resHeaders })),
    resHeaders
  }
}

function sessionCookieFor(userId: string): string {
  return `${SESSION_COOKIE_NAME}=${signSession(userId)}`
}

async function countUsers(username: string): Promise<number> {
  const rows = await db
    .select({ id: account__user_.id })
    .from(account__user_)
    .where(eq(account__user_.username_, username))

  return rows.length
}

async function removeTestUsers() {
  await db.delete(account__user_).where(like(account__user_.username_, `${usernamePrefix}%`))
}

beforeAll(() => {
  // The suite runs from .env; a checkout without the secret still gets a usable one.
  process.env.SESSION_SECRET ??= 'integration-test-secret'
})

beforeEach(removeTestUsers)
afterEach(removeTestUsers)

describe('account.logIn', () => {
  it('creates exactly one user for a name nobody used yet', async () => {
    const username = `${usernamePrefix}new`
    const { trpc, resHeaders } = await caller()

    const user = await trpc.account.logIn({ username })

    expect(user.username).toBe(username)
    expect(await countUsers(username)).toBe(1)
    expect(resHeaders.get('set-cookie')).toContain(`${SESSION_COOKIE_NAME}=${user.id}.`)
  })

  it('signs you in as the same person the second time and adds no row', async () => {
    const username = `${usernamePrefix}repeat`

    const first = await (await caller()).trpc.account.logIn({ username })
    const second = await (await caller()).trpc.account.logIn({ username })

    expect(second.id).toBe(first.id)
    expect(await countUsers(username)).toBe(1)
  })

  it('refuses a name with a space', async () => {
    const { trpc } = await caller()

    await expect(trpc.account.logIn({ username: 'zła nazwa' })).rejects.toThrow()
  })
})

describe('account.getCurrentUser', () => {
  it('returns null for a visitor with no cookie', async () => {
    const { trpc } = await caller()

    expect(await trpc.account.getCurrentUser()).toBeNull()
  })

  it('returns the user carried by a valid cookie', async () => {
    const username = `${usernamePrefix}current`
    const created = await (await caller()).trpc.account.logIn({ username })

    const { trpc } = await caller(sessionCookieFor(created.id))
    const current = await trpc.account.getCurrentUser()

    expect(current?.id).toBe(created.id)
    expect(current?.username).toBe(username)
  })

  it('returns null for a forged cookie', async () => {
    const username = `${usernamePrefix}forged`
    const created = await (await caller()).trpc.account.logIn({ username })

    const { trpc } = await caller(`${SESSION_COOKIE_NAME}=${created.id}.forged`)

    expect(await trpc.account.getCurrentUser()).toBeNull()
  })
})

describe('account.logOut', () => {
  it('expires the session cookie', async () => {
    const username = `${usernamePrefix}logout`
    const created = await (await caller()).trpc.account.logIn({ username })

    const { trpc, resHeaders } = await caller(sessionCookieFor(created.id))
    const result = await trpc.account.logOut()

    expect(result).toEqual({ loggedOut: true })
    expect(resHeaders.get('set-cookie')).toContain('Max-Age=0')
  })
})
