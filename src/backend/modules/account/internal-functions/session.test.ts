import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  buildClearedSessionCookie,
  buildSessionCookie,
  readSessionUserId,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifySession
} from './session'

const userId = '0198df77-9122-7000-8000-000000000001'
const originalSecret = process.env.SESSION_SECRET

beforeAll(() => {
  process.env.SESSION_SECRET = 'unit-test-secret'
})

afterAll(() => {
  if (originalSecret === undefined) delete process.env.SESSION_SECRET
  else process.env.SESSION_SECRET = originalSecret
})

describe('session cookie signing', () => {
  it('round-trips a freshly signed value', () => {
    expect(verifySession(signSession(userId))).toBe(userId)
  })

  it('rejects a tampered signature', () => {
    const [id, signature] = signSession(userId).split('.')
    const tampered = `${id}.${signature.slice(0, -1)}${signature.endsWith('A') ? 'B' : 'A'}`

    expect(verifySession(tampered)).toBeNull()
  })

  it('rejects a value signed for another user id', () => {
    const stolen = `0198df77-9122-7000-8000-000000000002.${signSession(userId).split('.')[1]}`

    expect(verifySession(stolen)).toBeNull()
  })

  it('rejects an unsigned value', () => {
    expect(verifySession(userId)).toBeNull()
    expect(verifySession('')).toBeNull()
  })

  it('rejects a value signed with a different secret', () => {
    const foreign = signSession(userId)
    process.env.SESSION_SECRET = 'another-secret'

    try {
      expect(verifySession(foreign)).toBeNull()
    } finally {
      process.env.SESSION_SECRET = 'unit-test-secret'
    }
  })
})

describe('reading the request cookie', () => {
  it('finds the session among other cookies', () => {
    const header = `theme=dark; ${SESSION_COOKIE_NAME}=${signSession(userId)}; locale=en`

    expect(readSessionUserId(header)).toBe(userId)
  })

  it('returns null without a cookie header', () => {
    expect(readSessionUserId(null)).toBeNull()
    expect(readSessionUserId('theme=dark')).toBeNull()
  })

  it('returns null for a forged session cookie', () => {
    expect(readSessionUserId(`${SESSION_COOKIE_NAME}=${userId}.forged`)).toBeNull()
  })
})

describe('set-cookie values', () => {
  it('locks the cookie down and keeps it for thirty days', () => {
    const cookie = buildSessionCookie(userId)

    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=${userId}.`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain(`Max-Age=${SESSION_MAX_AGE_SECONDS}`)
    expect(SESSION_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 30)
  })

  it('expires the cookie when signing out', () => {
    expect(buildClearedSessionCookie()).toContain(`${SESSION_COOKIE_NAME}=;`)
    expect(buildClearedSessionCookie()).toContain('Max-Age=0')
  })
})
