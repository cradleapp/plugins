import type { WebPluginContext } from '@cradle/plugin-sdk/web'
import {
  AlertLine as AlertIcon,
  PlayCircleLine as StartIcon,
  Refresh1Line as RefreshIcon,
  ServerLine as ServerIcon,
  StopCircleLine as StopIcon,
} from '@mingcute/react'
import { useCallback, useEffect, useState } from 'react'

import { Alert, Badge, Button, Card, Input, Label, Skeleton, StatusDot, UiStyles } from './ui'

interface SidecarStatus {
  installed: boolean
  version: string | null
  running: boolean
  healthy: boolean
  endpoint: string
  port: number
  models: string[]
  accountFileCount: number
  authenticatingProviders: string[]
  error: string | null
}

type AuthProvider = 'codex' | 'claude' | 'gemini'
type PanelAction = 'start' | 'stop' | 'save' | `auth-${AuthProvider}`

const AUTH_PROVIDERS: Array<{ id: AuthProvider, label: string }> = [
  { id: 'codex', label: 'Codex' },
  { id: 'claude', label: 'Claude' },
  { id: 'gemini', label: 'Gemini' },
]

interface StatusResponse {
  ok: boolean
  status?: SidecarStatus
  error?: string
}

function CliProxyApiPanel({ routes, isActive }: { routes: WebPluginContext['routes'], isActive: boolean }) {
  const [status, setStatus] = useState<SidecarStatus | null>(null)
  const [port, setPort] = useState('8317')
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<PanelAction | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await routes.fetch('/status')
      const body = await response.json() as StatusResponse
      if (!response.ok || !body.ok || !body.status) {
        throw new Error(body.error ?? `HTTP ${response.status}`)
      }
      setStatus(body.status)
      setPort(String(body.status.port))
    }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
    finally {
      setLoading(false)
    }
  }, [routes])

  const authenticate = useCallback(async (provider: AuthProvider) => {
    setAction(`auth-${provider}`)
    setError(null)
    try {
      const response = await routes.fetch(`/auth/${provider}`, { method: 'POST' })
      const body = await response.json() as StatusResponse
      if (!response.ok || !body.ok || !body.status) {
        throw new Error(body.error ?? `HTTP ${response.status}`)
      }
      setStatus(body.status)
    }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
    finally {
      setAction(null)
    }
  }, [routes])

  useEffect(() => {
    if (isActive) { void refresh() }
  }, [isActive, refresh])

  // Poll while a transient state is in flight: OAuth login pending, or the
  // sidecar is up but not yet healthy.
  const inProgress = Boolean(
    status?.authenticatingProviders.length || (status?.running && !status.healthy),
  )
  useEffect(() => {
    if (!isActive || !inProgress) { return }
    const timer = setInterval(() => void refresh(), 3000)
    return () => clearInterval(timer)
  }, [isActive, inProgress, refresh])

  const runAction = useCallback(async (nextAction: 'start' | 'stop') => {
    setAction(nextAction)
    setError(null)
    try {
      const response = await routes.fetch(`/${nextAction}`, { method: 'POST' })
      const body = await response.json() as StatusResponse
      if (!response.ok || !body.ok || !body.status) {
        throw new Error(body.error ?? `HTTP ${response.status}`)
      }
      setStatus(body.status)
    }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
    finally {
      setAction(null)
    }
  }, [routes])

  const savePort = useCallback(async () => {
    setAction('save')
    setError(null)
    try {
      const response = await routes.fetch('/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ port: Number(port) }),
      })
      const body = await response.json() as { ok: boolean, error?: string }
      if (!response.ok || !body.ok) { throw new Error(body.error ?? `HTTP ${response.status}`) }
      await refresh()
    }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
    finally {
      setAction(null)
    }
  }, [port, refresh, routes])

  return (
    <div className="clp-root">
      <UiStyles />
      <Card
        title={(
          <>
            <ServerIcon size={16} aria-hidden="true" />
            CLIProxyAPI
          </>
        )}
        description="Managed multi-account model router on this device."
        actions={(
          <Button variant="ghost" icon aria-label="Refresh status" onClick={() => void refresh()} disabled={loading}>
            <RefreshIcon size={15} aria-hidden="true" />
          </Button>
        )}
      >
        {loading && !status
          ? <Skeleton height={22} />
          : (
              <div className="clp-row">
                <Badge tone={status?.installed ? 'solid' : 'outline'}>
                  {status?.installed ? `Runtime ${status.version ?? ''}` : 'Runtime not installed'}
                </Badge>
                {status?.healthy
                  ? <Badge tone="success"><StatusDot />Healthy</Badge>
                  : status?.running
                    ? <Badge tone="warning"><StatusDot />Starting</Badge>
                    : <Badge>Stopped</Badge>}
                {status?.models.length
                  ? (
                      <Badge>
                        {status.models.length}
                        {' '}
                        models
                      </Badge>
                    )
                  : null}
              </div>
            )}
        {!status?.installed && (
          <Alert icon={<AlertIcon size={15} aria-hidden="true" />} title="Runtime required">
            Install “CLIProxyAPI runtime” from the Resources page, then return here to start it.
          </Alert>
        )}
        {error && (
          <Alert tone="error" icon={<AlertIcon size={15} aria-hidden="true" />} title="CLIProxyAPI action failed">
            {error}
          </Alert>
        )}
        <div className="clp-row">
          <Button
            onClick={() => void runAction('start')}
            disabled={!status?.installed || status.running || action !== null}
          >
            <StartIcon size={14} aria-hidden="true" />
            Start
          </Button>
          <Button
            variant="outline"
            onClick={() => void runAction('stop')}
            disabled={!status?.running || action !== null}
          >
            <StopIcon size={14} aria-hidden="true" />
            Stop
          </Button>
        </div>
      </Card>

      <Card
        title="Accounts"
        description="Start an upstream OAuth flow. CLIProxyAPI opens the provider login in your browser and stores the resulting account file in plugin-owned storage."
      >
        <div className="clp-row">
          <Badge>
            {status?.accountFileCount ?? 0}
            {' '}
            account files
          </Badge>
          {status?.authenticatingProviders.length
            ? <Badge tone="warning"><StatusDot />Authentication in progress</Badge>
            : null}
        </div>
        <div className="clp-row">
          {AUTH_PROVIDERS.map(provider => (
            <Button
              key={provider.id}
              variant="outline"
              onClick={() => void authenticate(provider.id)}
              disabled={!status?.installed || action !== null || status.authenticatingProviders.includes(provider.id)}
            >
              Add
              {' '}
              {provider.label}
            </Button>
          ))}
        </div>
      </Card>

      <Card
        title="Local endpoint"
        description="The sidecar is always restricted to 127.0.0.1."
      >
        <div>
          <Label htmlFor="cli-proxy-api-port">Port</Label>
          <div className="clp-row" style={{ flexWrap: 'nowrap' }}>
            <Input
              id="cli-proxy-api-port"
              type="number"
              min={1024}
              max={65535}
              value={port}
              onChange={event => setPort(event.target.value)}
              disabled={status?.running || action !== null}
            />
            <Button variant="outline" onClick={() => void savePort()} disabled={status?.running || action !== null}>
              Save
            </Button>
          </div>
        </div>
        <p className="clp-mono clp-muted" style={{ margin: 0, fontSize: 12, wordBreak: 'break-all' }}>
          {status?.endpoint ?? `http://127.0.0.1:${port}/v1`}
        </p>
      </Card>

      {status?.models.length
        ? (
            <Card title="Available models" description="Discovered from the running sidecar.">
              <div className="clp-row" style={{ gap: 6 }}>
                {status.models.map(model => <span key={model} className="clp-mono"><Badge>{model}</Badge></span>)}
              </div>
            </Card>
          )
        : null}
    </div>
  )
}

export function activate(ctx: WebPluginContext): void {
  ctx.panels.register({
    id: 'cli-proxy-api',
    title: 'CLIProxyAPI',
    component: props => <CliProxyApiPanel {...props} routes={ctx.routes} />,
    location: 'sidebar',
  })
}
