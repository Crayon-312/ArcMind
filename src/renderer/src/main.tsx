import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './ui/App'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { SystemTelemetryLab } from './ui/SystemTelemetryLab'
import './styles.css'

const route = new URL(window.location.href).searchParams.get('view')
const RootView = route === 'system-lab' ? SystemTelemetryLab : App

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RootView />
    </ErrorBoundary>
  </React.StrictMode>
)
