import { describe, expect, it } from 'vitest'
import { calculateCpuUsagePct, readCpuTimeSample, resolveUsageStatus } from '../../src/main/system/systemTelemetry'

describe('system telemetry helpers', () => {
  it('calculates CPU usage from two os.cpus samples', () => {
    const previous = readCpuTimeSample([
      {
        model: 'cpu',
        speed: 1,
        times: { user: 100, nice: 0, sys: 100, idle: 800, irq: 0 }
      }
    ])
    const current = readCpuTimeSample([
      {
        model: 'cpu',
        speed: 1,
        times: { user: 160, nice: 0, sys: 140, idle: 900, irq: 0 }
      }
    ])

    expect(calculateCpuUsagePct(previous, current)).toBe(50)
  })

  it('marks high usage bands without relying only on colors', () => {
    expect(resolveUsageStatus(null)).toBe('unknown')
    expect(resolveUsageStatus(41)).toBe('ok')
    expect(resolveUsageStatus(74)).toBe('busy')
    expect(resolveUsageStatus(94)).toBe('critical')
  })
})
