import { ParticleCore } from '../visual/ParticleCore'
import { SystemTelemetryProjection, createSystemTelemetryVisualSignal, resolveSystemTelemetryCoreMode, useSystemTelemetrySnapshot } from './SystemTelemetryProjection'

export function SystemTelemetryLab(): JSX.Element {
  const { snapshot } = useSystemTelemetrySnapshot({ demoFallback: true })
  const mode = resolveSystemTelemetryCoreMode(snapshot)
  const signal = createSystemTelemetryVisualSignal(snapshot)

  return (
    <main className="app-shell system-lab-shell">
      <ParticleCore mode={mode} signal={signal} workbenchOpen={false} composerOpen={false} />
      <div className="ambient-grid" />
      <section className="system-lab-surface" aria-label="ArcMind system telemetry concept">
        <header className="system-lab-brand">
          <h1>ArcMind</h1>
          <span className={`status-dot status-${mode}`} />
        </header>
        <SystemTelemetryProjection demoFallback />
      </section>
    </main>
  )
}
