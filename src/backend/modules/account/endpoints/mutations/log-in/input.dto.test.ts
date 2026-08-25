import { describe, expect, it } from 'vitest'
import { LogInInputDTOZ } from './input.dto'

function accepts(username: string): boolean {
  return LogInInputDTOZ.safeParse({ username }).success
}

describe('username rule', () => {
  it('accepts letters, digits, underscore, hyphen and dot', () => {
    expect(accepts('ania')).toBe(true)
    expect(accepts('a_b-c.d')).toBe(true)
    expect(accepts('A1')).toBe(true)
    expect(accepts('x'.repeat(64))).toBe(true)
  })

  it('rejects an empty name', () => {
    expect(accepts('')).toBe(false)
  })

  it('rejects a name longer than 64 characters', () => {
    expect(accepts('x'.repeat(65))).toBe(false)
  })

  it('rejects spaces and letters outside a-z', () => {
    expect(accepts('zła nazwa')).toBe(false)
    expect(accepts('ania nowak')).toBe(false)
    expect(accepts('zła')).toBe(false)
    expect(accepts('an!a')).toBe(false)
  })
})
