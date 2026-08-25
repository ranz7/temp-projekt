import { describe, expect, it } from 'vitest'
import { ListNotesOutputDTOZ } from './output.dto'

describe('ListNotesOutputDTOZ', () => {
  it('rejects a note without title', () => {
    const result = ListNotesOutputDTOZ.safeParse({
      notes: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          body: 'Missing title',
          createdAt: new Date()
        }
      ]
    })

    expect(result.success).toBe(false)
  })
})
