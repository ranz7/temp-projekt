import { createHmac, timingSafeEqual } from 'node:crypto'

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

/**
 * How the app was reached, as far as this one request can tell.
 * `url` is the address the app itself received; behind a proxy that is the
 * inside-the-network address, so the forwarded headers matter more.
 */
export type RequestOrigin = {
  headers: Headers
  url?: string | null
}

/** Every protocol named by the proxy headers, lowercased. */
function forwardedProtocols(headers: Headers): string[] {
  const protocols: string[] = []

  const forwardedProto = headers.get('x-forwarded-proto')
  if (forwardedProto !== null) {
    protocols.push(...forwardedProto.split(',').map(entry => entry.trim().toLowerCase()))
  }

  // RFC 7239: `Forwarded: for=1.2.3.4;proto=https, for=5.6.7.8`
  const forwarded = headers.get('forwarded')
  if (forwarded !== null) {
    for (const match of forwarded.matchAll(/proto\s*=\s*"?([A-Za-z]+)"?/g)) {
      protocols.push(match[1].toLowerCase())
    }
  }

  return protocols
}

/** `SESSION_COOKIE_SECURE` when the deployment sets it, otherwise null for "work it out". */
function configuredCookieSecurity(): boolean | null {
  const setting = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase()
  if (setting === undefined || setting === '' || setting === 'auto') return null

  return setting === 'true' || setting === '1' || setting === 'on' || setting === 'yes'
}

/**
 * Was this request genuinely reached over HTTPS?
 *
 * A browser throws away a `Secure` cookie that arrives over plain HTTP, so
 * marking it `Secure` on an HTTP-only deployment means nobody can log in.
 * Any signal saying HTTPS wins, so a caller sending `x-forwarded-proto: http`
 * to an HTTPS site cannot talk the app out of `Secure`. A deployment that does
 * not trust its proxy at all sets `SESSION_COOKIE_SECURE=true` and settles it.
 */
export function isSecureRequest(origin: RequestOrigin): boolean {
  const configured = configuredCookieSecurity()
  if (configured !== null) return configured

  if (forwardedProtocols(origin.headers).includes('https')) return true

  return origin.url?.toLowerCase().startsWith('https:') === true
}

function cookieAttributes(maxAgeSeconds: number, secure: boolean): string {
  const attributes = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`]
  if (secure) attributes.push('Secure')

  return attributes.join('; ')
}

/** `Set-Cookie` value that signs the user in for thirty days. */
export function buildSessionCookie(userId: string, secure: boolean): string {
  return `${SESSION_COOKIE_NAME}=${signSession(userId)}; ${cookieAttributes(SESSION_MAX_AGE_SECONDS, secure)}`
}

/** `Set-Cookie` value that signs the current user out. */
export function buildClearedSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE_NAME}=; ${cookieAttributes(0, secure)}`
}

function requireResponseHeaders(resHeaders: Headers | null): Headers {
  if (resHeaders === null) {
    throw new Error('No response headers on this request - the login cookie cannot be changed.')
  }

  return resHeaders
}

/** Signs the user in by appending the session cookie to the response. */
export function setSessionCookie(
  resHeaders: Headers | null,
  userId: string,
  secure: boolean
): void {
  requireResponseHeaders(resHeaders).append('set-cookie', buildSessionCookie(userId, secure))
}

/** Signs the current user out by expiring the session cookie. */
export function clearSessionCookie(resHeaders: Headers | null, secure: boolean): void {
  requireResponseHeaders(resHeaders).append('set-cookie', buildClearedSessionCookie(secure))
}
