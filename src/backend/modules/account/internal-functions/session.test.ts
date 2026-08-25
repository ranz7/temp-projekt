import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  buildClearedSessionCookie,
  buildSessionCookie,
  isSecureRequest,
  readSessionUserId,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifySession
} from './session'

function headers(entries: Record<string, string> = {}): Headers {
  return new Headers(entries)
}

const userId = '0198df77-9122-7000-8000-000000000001'
const originalSecret = process.env.SESSION_SECRET
const originalCookieSecurity = process.env.SESSION_COOKIE_SECURE

beforeAll(() => {
  process.env.SESSION_SECRET = 'unit-test-secret'
})

beforeEach(() => {
  delete process.env.SESSION_COOKIE_SECURE
})

afterAll(() => {
  if (originalSecret === undefined) delete process.env.SESSION_SECRET
  else process.env.SESSION_SECRET = originalSecret

  if (originalCookieSecurity === undefined) delete process.env.SESSION_COOKIE_SECURE
  else process.env.SESSION_COOKIE_SECURE = originalCookieSecurity
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

describe('how the site was reached', () => {
  it('calls a request the proxy marks as https secure', () => {
    expect(isSecureRequest({ headers: headers({ 'x-forwarded-proto': 'https' }) })).toBe(true)
    expect(isSecureRequest({ headers: headers({ forwarded: 'for=1.2.3.4;proto=https' }) })).toBe(
      true
    )
  })

  it('calls a plain http request on the machine address not secure', () => {
    expect(
      isSecureRequest({ headers: headers(), url: 'http://152.53.64.162/api/trpc/account.logIn' })
    ).toBe(false)
    expect(isSecureRequest({ headers: headers({ 'x-forwarded-proto': 'http' }) })).toBe(false)
  })

  it('reads the scheme off the address when no proxy header says anything', () => {
    expect(isSecureRequest({ headers: headers(), url: 'https://judge.example/api' })).toBe(true)
  })

  it('keeps https when a caller adds an http hop of their own', () => {
    expect(isSecureRequest({ headers: headers({ 'x-forwarded-proto': 'http, https' }) })).toBe(true)
    expect(
      isSecureRequest({
        headers: headers({ 'x-forwarded-proto': 'http' }),
        url: 'https://judge.example/api'
      })
    ).toBe(true)
  })

  it('lets the deployment settle it either way', () => {
    process.env.SESSION_COOKIE_SECURE = 'true'
    expect(isSecureRequest({ headers: headers({ 'x-forwarded-proto': 'http' }) })).toBe(true)

    process.env.SESSION_COOKIE_SECURE = 'false'
    expect(isSecureRequest({ headers: headers({ 'x-forwarded-proto': 'https' }) })).toBe(false)

    process.env.SESSION_COOKIE_SECURE = 'auto'
    expect(isSecureRequest({ headers: headers({ 'x-forwarded-proto': 'https' }) })).toBe(true)
  })
})

describe('set-cookie values', () => {
  it('locks the cookie down and keeps it for thirty days', () => {
    const cookie = buildSessionCookie(userId, true)

    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=${userId}.`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain(`Max-Age=${SESSION_MAX_AGE_SECONDS}`)
    expect(SESSION_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 30)
  })

  it('marks the cookie Secure for a site reached over https', () => {
    expect(buildSessionCookie(userId, true)).toContain('; Secure')
    expect(buildClearedSessionCookie(true)).toContain('; Secure')
  })

  it('leaves Secure off a site served over plain http, so the browser keeps it', () => {
    expect(buildSessionCookie(userId, false)).not.toContain('Secure')
    expect(buildClearedSessionCookie(false)).not.toContain('Secure')
  })

  it('signs the same value and keeps the same expiry either way', () => {
    const overHttps = buildSessionCookie(userId, true)
    const overHttp = buildSessionCookie(userId, false)
    const signedValue = `${SESSION_COOKIE_NAME}=${signSession(userId)}`

    expect(overHttps.startsWith(`${signedValue};`)).toBe(true)
    expect(overHttp.startsWith(`${signedValue};`)).toBe(true)
    expect(overHttps).toBe(`${overHttp}; Secure`)
    for (const cookie of [overHttps, overHttp]) {
      expect(cookie).toContain(`Max-Age=${SESSION_MAX_AGE_SECONDS}`)
      expect(cookie).toContain('HttpOnly')
      expect(cookie).toContain('SameSite=Lax')
    }
  })

  it('expires the cookie when signing out', () => {
    expect(buildClearedSessionCookie(false)).toContain(`${SESSION_COOKIE_NAME}=;`)
    expect(buildClearedSessionCookie(false)).toContain('Max-Age=0')
  })
})
