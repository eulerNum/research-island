import { describe, it, expect } from 'vitest'
import { generateId } from '../../utils/idGenerator'
import type { ResearchMap } from '../types'

describe('Phase A smoke tests', () => {
  it('generateId returns a non-empty string', () => {
    const id = generateId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('two generateId calls produce different ids', () => {
    expect(generateId()).not.toBe(generateId())
  })

  it('ResearchMap shape compiles with 5 expected arrays', () => {
    const empty: ResearchMap = {
      islands: [],
      bridges: [],
      roads: [],
      papers: [],
      gaps: [],
    }
    expect(Object.keys(empty).sort()).toEqual(
      ['bridges', 'gaps', 'islands', 'papers', 'roads'],
    )
  })
})
