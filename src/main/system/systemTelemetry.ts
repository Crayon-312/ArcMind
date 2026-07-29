import { cpus, freemem, totalmem, type CpuInfo } from 'node:os'
import { statfs } from 'node:fs/promises'
import type { SystemDiskMetric, SystemGpuMetric, SystemMetricStatus, SystemTelemetrySnapshot } from '../../shared'

export interface CpuTimeSample {
  idle: number
  total: number
}

export interface SystemTelemetryInput {
  diskPath: string
  gpuInfo?: unknown
  gpuFeatureStatus?: Record<string, string>
}

let previousCpuSample: CpuTimeSample | null = null

export async function getSystemTelemetrySnapshot(input: SystemTelemetryInput): Promise<SystemTelemetrySnapshot> {
  const cpu = await readCpuMetric()
  const memory = readMemoryMetric()
  const disk = await readDiskMetric(input.diskPath)
  const gpu = readGpuMetric(input.gpuInfo, input.gpuFeatureStatus)

  return {
    capturedAt: new Date().toISOString(),
    cpu,
    memory,
    disk,
    gpu
  }
}

export function readCpuTimeSample(cpuInfos: CpuInfo[]): CpuTimeSample {
  return cpuInfos.reduce<CpuTimeSample>(
    (sample, cpu) => {
      const times = cpu.times
      const total = times.user + times.nice + times.sys + times.idle + times.irq
      return {
        idle: sample.idle + times.idle,
        total: sample.total + total
      }
    },
    { idle: 0, total: 0 }
  )
}

export function calculateCpuUsagePct(previous: CpuTimeSample, current: CpuTimeSample): number | null {
  const idleDelta = current.idle - previous.idle
  const totalDelta = current.total - previous.total

  if (totalDelta <= 0 || idleDelta < 0) {
    return null
  }

  return normalizePct(((totalDelta - idleDelta) / totalDelta) * 100)
}

export function resolveUsageStatus(usagePct: number | null, busyAt = 72, criticalAt = 90): SystemMetricStatus {
  if (usagePct === null) {
    return 'unknown'
  }

  if (usagePct >= criticalAt) {
    return 'critical'
  }

  if (usagePct >= busyAt) {
    return 'busy'
  }

  return 'ok'
}

async function readCpuMetric(): Promise<SystemTelemetrySnapshot['cpu']> {
  const firstSample = previousCpuSample ?? readCpuTimeSample(cpus())
  await wait(120)
  const nextSample = readCpuTimeSample(cpus())
  previousCpuSample = nextSample
  const usagePct = calculateCpuUsagePct(firstSample, nextSample)

  return {
    usagePct,
    cores: cpus().length,
    status: resolveUsageStatus(usagePct, 68, 88)
  }
}

function readMemoryMetric(): SystemTelemetrySnapshot['memory'] {
  const totalBytes = totalmem()
  const usedBytes = Math.max(0, totalBytes - freemem())
  const usagePct = totalBytes > 0 ? normalizePct((usedBytes / totalBytes) * 100) : null

  return {
    usedBytes,
    totalBytes,
    usagePct,
    status: resolveUsageStatus(usagePct)
  }
}

async function readDiskMetric(diskPath: string): Promise<SystemDiskMetric> {
  try {
    const stats = await statfs(diskPath)
    const totalBytes = stats.blocks * stats.bsize
    const freeBytes = stats.bavail * stats.bsize
    const usedBytes = Math.max(0, totalBytes - freeBytes)
    const usagePct = totalBytes > 0 ? normalizePct((usedBytes / totalBytes) * 100) : null

    return {
      usedBytes,
      totalBytes,
      usagePct,
      status: resolveUsageStatus(usagePct, 78, 92)
    }
  } catch {
    return {
      usedBytes: null,
      totalBytes: null,
      usagePct: null,
      status: 'unknown'
    }
  }
}

function readGpuMetric(gpuInfo: unknown, gpuFeatureStatus?: Record<string, string>): SystemGpuMetric {
  const featureStatus = gpuFeatureStatus?.gpu_compositing ?? 'unknown'
  const usagePct = null

  return {
    name: findGpuName(gpuInfo),
    usagePct,
    featureStatus,
    status: resolveGpuStatus(featureStatus)
  }
}

function resolveGpuStatus(featureStatus: string): SystemMetricStatus {
  if (featureStatus === 'unknown') {
    return 'unknown'
  }

  if (/disabled|unavailable|off/i.test(featureStatus)) {
    return 'critical'
  }

  if (/software/i.test(featureStatus)) {
    return 'busy'
  }

  return 'ok'
}

function findGpuName(gpuInfo: unknown): string {
  const info = toRecord(gpuInfo)
  const devices = Array.isArray(info?.gpuDevice) ? info.gpuDevice : []
  const activeDevice = devices.find((device) => toRecord(device)?.active === true) ?? devices[0]
  const device = toRecord(activeDevice)
  const deviceString = readString(device, 'deviceString')
  const vendorString = readString(device, 'vendorString')

  if (deviceString && vendorString && !deviceString.includes(vendorString)) {
    return `${vendorString} ${deviceString}`
  }

  return deviceString || vendorString || 'GPU'
}

function readString(record: Record<string, unknown> | null, key: string): string {
  const value = record?.[key]
  return typeof value === 'string' ? value : ''
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function normalizePct(value: number): number {
  const bounded = Math.max(0, Math.min(100, value))
  return Math.round(bounded * 10) / 10
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
