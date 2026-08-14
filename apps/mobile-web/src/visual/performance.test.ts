import { describe, expect, it } from 'vitest'

import { resolveVisualPerformanceProfile } from './performance'

describe('resolveVisualPerformanceProfile', () => {
  it('uses the high profile on capable desktop hardware', () => {
    expect(resolveVisualPerformanceProfile(1, 12)).toMatchObject({
      quality: 'high',
      particleCount: 7200,
      ringCount: 3,
      advancedGlow: true
    })
  })

  it('reduces pixel ratio and particle count on dense or midrange devices', () => {
    expect(resolveVisualPerformanceProfile(3, 8)).toMatchObject({
      quality: 'medium',
      particleCount: 5200,
      maxPixelRatio: 1.5,
      ringCount: 2
    })
  })

  it('uses the low profile for constrained CPUs', () => {
    expect(resolveVisualPerformanceProfile(2, 4)).toMatchObject({
      quality: 'low',
      particleCount: 3200,
      maxPixelRatio: 1.25,
      ringCount: 1,
      advancedGlow: false
    })
  })
})
