import { describe, expect, it } from 'vitest'
import { getRevealChunkSize, revealNextChunk } from '../../src/renderer/src/ui/typewriter'

describe('typewriter reveal', () => {
  it('reveals large model deltas in smaller chunks instead of all at once', () => {
    const target = 'ArcMind '.repeat(80)
    const next = revealNextChunk('', target)

    expect(next.length).toBeGreaterThan(0)
    expect(next.length).toBeLessThan(target.length)
  })

  it('reveals the final character when the backlog is small', () => {
    expect(revealNextChunk('ArcMin', 'ArcMind')).toBe('ArcMind')
  })

  it('adapts chunk size to backlog so long answers catch up without popping in', () => {
    expect(getRevealChunkSize(20)).toBe(1)
    expect(getRevealChunkSize(100)).toBeGreaterThan(getRevealChunkSize(20))
    expect(getRevealChunkSize(1400)).toBeGreaterThan(getRevealChunkSize(100))
  })
})
