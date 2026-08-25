import { createHmac, timingSafeEqual } from 'node:crypto'
import { isProduction } from '@shared/environment'

/** Name of the cookie carrying the signed-in user. */
export const SESSION_COOKIE_NAME = 'oj_session'

/** Thirty days, in seconds. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

function getSessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET
  return secret !== undefined && secret.length > 0 ? secret : null
}

function signature(userId: string, secret: string): string {
  return createHmac('sha256', secret).update(userId).digest('base64url')
}

/** `<userId>.<hmac>` - the cookie value a browser cannot forge. */
export function signSession(userId: string): string {
  const secret = getSessionSecret()
  if (secret === null) {
    throw new Error('SESSION_SECRET is not set - the login cookie cannot be signed.')
  }

  return `${userId}.${signature(userId, secret)}`
}

/** User id of a cookie value whose signature verifies, otherwise null. */
export function verifySession(value: string): string | null {
  const secret = getSessionSecret()
  if (secret === null) return null

  const separator = value.lastIndexOf('.')
  if (separator <= 0 || separator === value.length - 1) return null

  const userId = value.slice(0, separator)
  const given = Buffer.from(value.slice(separator + 1))
  const expected = Buffer.from(signature(userId, secret))
  if (given.length !== expected.length) return null

  return timingSafeEqual(given, expected) ? userId : null
}

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (cookieHeader === null) return null

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    if (part.slice(0, separator).trim() !== name) continue

    return part.slice(separator + 1).trim()
  }

  return null
}

/** Signed-in user id carried by a request's `Cookie` header, otherwise null. */
export function readSessionUserId(cookieHeader: string | null): string | null {
  const value = readCookie(cookieHeader, SESSION_COOKIE_NAME)
  return value === null ? null : verifySession(value)
}

function cookieAttributes(maxAgeSeconds: number): string {
  const attributes = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`]
  if (isProduction()) attributes.push('Secure')

  return attributes.join('; ')
}

/** `Set-Cookie` value that signs the user in for thirty days. */
export function buildSessionCookie(userId: string): string {
  return `${SESSION_COOKIE_NAME}=${signSession(userId)}; ${cookieAttributes(SESSION_MAX_AGE_SECONDS)}`
}

/** `Set-Cookie` value that signs the current user out. */
export function buildClearedSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; ${cookieAttributes(0)}`
}

function requireResponseHeaders(resHeaders: Headers | null): Headers {
  if (resHeaders === null) {
    throw new Error('No response headers on this request - the login cookie cannot be changed.')
  }

  return resHeaders
}

/** Signs the user in by appending the session cookie to the response. */
export function setSessionCookie(resHeaders: Headers | null, userId: string): void {
  requireResponseHeaders(resHeaders).append('set-cookie', buildSessionCookie(userId))
}

/** Signs the current user out by expiring the session cookie. */
export function clearSessionCookie(resHeaders: Headers | null): void {
  requireResponseHeaders(resHeaders).append('set-cookie', buildClearedSessionCookie())
}
