import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Cpu, HardDrive, MemoryStick, MonitorCog, RefreshCw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CoreMode, SystemMetricStatus, SystemTelemetrySnapshot, VisualSignal } from '../../../shared'

interface MetricViewModel {
  id: 'cpu' | 'memory' | 'disk' | 'gpu'
  label: string
  value: number | null
  status: SystemMetricStatus
  caption: string
  icon: LucideIcon
}

interface SystemTelemetryProjectionProps {
  demoFallback?: boolean
  hidden?: boolean
}

interface SystemTelemetryState {
  snapshot: SystemTelemetrySnapshot | null
  source: 'live' | 'demo'
  refreshing: boolean
  refreshNow: () => void
}

export function SystemTelemetryProjection({ demoFallback = false, hidden = false }: SystemTelemetryProjectionProps): JSX.Element | null {
  const { snapshot, source, refreshing, refreshNow } = useSystemTelemetrySnapshot({ demoFallback })
  const metrics = useMemo(() => (snapshot ? createMetricViewModels(snapshot) : []), [snapshot])
  const overall = useMemo(() => resolveOverallStatus(metrics), [metrics])
  const worstStatus = useMemo(() => resolveWorstStatus(metrics), [metrics])

  if (!snapshot) {
    return null
  }

  return (
    <section className={`system-telemetry-projection ${hidden ? 'is-hidden' : ''}`} aria-label="系统状态投影" aria-hidden={hidden}>
      <article className="system-mini-panel" data-status={worstStatus}>
        <header className="system-mini-header">
          <div>
            <span data-source={source}>{source === 'live' ? 'LIVE' : 'DEMO'}</span>
            <strong>{overall}</strong>
          </div>
          <button className="system-refresh-button" type="button" title="刷新系统状态" tabIndex={hidden ? -1 : 0} onClick={refreshNow}>
            <RefreshCw size={14} className={refreshing ? 'is-spinning' : ''} />
          </button>
        </header>

        <div className="system-mini-metrics">
          {metrics.map((metric) => (
            <MetricRow key={metric.id} metric={metric} />
          ))}
        </div>
      </article>
    </section>
  )
}

export function useSystemTelemetrySnapshot({ demoFallback = false }: { demoFallback?: boolean } = {}): SystemTelemetryState {
  const [snapshot, setSnapshot] = useState<SystemTelemetrySnapshot | null>(() => (demoFallback ? createDemoSnapshot() : null))
  const [source, setSource] = useState<'live' | 'demo'>(demoFallback ? 'demo' : 'live')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshSignal, setRefreshSignal] = useState(0)

  useEffect(() => {
    let cancelled = false

    const update = async (): Promise<void> => {
      setRefreshing(true)
      try {
        const liveSnapshot = await window.arcMind?.system?.getTelemetrySnapshot?.()
        if (!cancelled && liveSnapshot) {
          setSnapshot(liveSnapshot)
          setSource('live')
          return
        }
      } catch {
        // Renderer previews without the preload bridge can opt into synthetic telemetry.
      } finally {
        if (!cancelled) {
          setRefreshing(false)
        }
      }

      if (!cancelled && demoFallback) {
        setSnapshot(createDemoSnapshot())
        setSource('demo')
      }
    }

    void update()
    const interval = window.setInterval(() => void update(), 1800)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [demoFallback, refreshSignal])

  return {
    snapshot,
    source,
    refreshing,
    refreshNow: () => setRefreshSignal((value) => value + 1)
  }
}

export function resolveSystemTelemetryCoreMode(snapshot: SystemTelemetrySnapshot | null): CoreMode {
  if (!snapshot) {
    return 'idle'
  }

  const worstStatus = resolveWorstStatus(createMetricViewModels(snapshot))
  if (worstStatus === 'critical') {
    return 'error'
  }
  if (worstStatus === 'busy') {
    return 'thinking'
  }
  return 'idle'
}

export function createSystemTelemetryVisualSignal(snapshot: SystemTelemetrySnapshot | null): VisualSignal {
  if (!snapshot) {
    return {
      audio: {
        level: 0,
        low: 0,
        mid: 0,
        high: 0,
        rhythm: 0
      },
      tokenPulse: 0,
      errorPulse: 0,
      thinkingLevel: 0,
      speakingLevel: 0
    }
  }

  const metrics = createMetricViewModels(snapshot)
  const averageLoad = (averageMetricUsage(metrics) ?? 0) / 100
  const hasCritical = metrics.some((metric) => metric.status === 'critical')

  return {
    audio: {
      level: Math.max(0.04, averageLoad * 0.22),
      low: (snapshot.cpu.usagePct ?? 0) / 150,
      mid: (snapshot.memory.usagePct ?? 0) / 170,
      high: (snapshot.disk.usagePct ?? 0) / 190,
      rhythm: hasCritical ? 0.6 : averageLoad * 0.28
    },
    tokenPulse: Math.floor(new Date(snapshot.capturedAt).getTime() / 2400),
    errorPulse: hasCritical ? 1 : 0,
    thinkingLevel: averageLoad * 0.58,
    speakingLevel: 0
  }
}

function MetricRow({ metric }: { metric: MetricViewModel }): JSX.Element {
  const Icon = metric.icon

  return (
    <article className="system-mini-metric" data-status={metric.status} style={meterStyle(metric.value)} title={metric.caption}>
      <Icon size={14} />
      <strong>{formatPercent(metric.value)}</strong>
      <span>{metric.label}</span>
    </article>
  )
}

function createMetricViewModels(snapshot: SystemTelemetrySnapshot): MetricViewModel[] {
  return [
    {
      id: 'cpu',
      label: 'CPU',
      value: snapshot.cpu.usagePct,
      status: snapshot.cpu.status,
      caption: `${snapshot.cpu.cores} cores`,
      icon: Cpu
    },
    {
      id: 'memory',
      label: 'RAM',
      value: snapshot.memory.usagePct,
      status: snapshot.memory.status,
      caption: `${formatBytes(snapshot.memory.usedBytes)} / ${formatBytes(snapshot.memory.totalBytes)}`,
      icon: MemoryStick
    },
    {
      id: 'disk',
      label: 'Disk',
      value: snapshot.disk.usagePct,
      status: snapshot.disk.status,
      caption: snapshot.disk.totalBytes ? `${formatBytes(snapshot.disk.usedBytes ?? 0)} / ${formatBytes(snapshot.disk.totalBytes)}` : 'pending',
      icon: HardDrive
    },
    {
      id: 'gpu',
      label: 'GPU',
      value: snapshot.gpu.usagePct,
      status: snapshot.gpu.status,
      caption: `${snapshot.gpu.name} · ${snapshot.gpu.featureStatus}`,
      icon: MonitorCog
    }
  ]
}

function createDemoSnapshot(): SystemTelemetrySnapshot {
  const t = Date.now() / 1000
  const cpu = 36 + Math.sin(t * 0.82) * 14 + Math.sin(t * 0.21) * 6
  const memory = 54 + Math.sin(t * 0.34 + 1.2) * 8
  const disk = 61 + Math.sin(t * 0.16 + 2.4) * 4

  return {
    capturedAt: new Date().toISOString(),
    cpu: {
      usagePct: normalizePct(cpu),
      cores: navigator.hardwareConcurrency || 8,
      status: resolveDemoStatus(cpu, 68, 88)
    },
    memory: {
      usedBytes: 18 * 1024 ** 3,
      totalBytes: 32 * 1024 ** 3,
      usagePct: normalizePct(memory),
      status: resolveDemoStatus(memory, 72, 90)
    },
    disk: {
      usedBytes: 612 * 1024 ** 3,
      totalBytes: 960 * 1024 ** 3,
      usagePct: normalizePct(disk),
      status: resolveDemoStatus(disk, 78, 92)
    },
    gpu: {
      name: 'ArcMind GPU channel',
      usagePct: null,
      featureStatus: 'enabled',
      status: 'ok'
    }
  }
}

function resolveOverallStatus(metrics: MetricViewModel[]): string {
  const worstStatus = resolveWorstStatus(metrics)
  if (worstStatus === 'critical') {
    return '需要关注'
  }
  if (worstStatus === 'busy') {
    return '高负载'
  }
  if (worstStatus === 'unknown') {
    return '部分待接入'
  }
  return '稳定'
}

function resolveWorstStatus(metrics: MetricViewModel[]): SystemMetricStatus {
  if (metrics.some((metric) => metric.status === 'critical')) {
    return 'critical'
  }
  if (metrics.some((metric) => metric.status === 'busy')) {
    return 'busy'
  }
  if (metrics.some((metric) => metric.status === 'unknown')) {
    return 'unknown'
  }
  return 'ok'
}

function averageMetricUsage(metrics: MetricViewModel[]): number | null {
  const values = metrics.map((metric) => metric.value).filter((value): value is number => value !== null)
  if (values.length === 0) {
    return null
  }
  return normalizePct(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function resolveDemoStatus(value: number, busyAt: number, criticalAt: number): SystemMetricStatus {
  if (value >= criticalAt) {
    return 'critical'
  }
  if (value >= busyAt) {
    return 'busy'
  }
  return 'ok'
}

function meterStyle(value: number | null): CSSProperties {
  return { '--metric-value': `${value ?? 0}%` } as CSSProperties
}

function formatPercent(value: number | null): string {
  return value === null ? '--' : `${Math.round(value)}%`
}

function formatBytes(value: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let amount = value
  let unitIndex = 0
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024
    unitIndex += 1
  }
  return `${amount >= 10 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unitIndex]}`
}

function normalizePct(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10
}
