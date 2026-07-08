import type { WebPluginContext } from '@cradle/plugin-sdk/web'
import { useCallback, useEffect, useState } from 'react'

interface PublicConfig {
  baseUrl: string
  enabled: boolean
  hasRuntimeToken: boolean
  mcpUrl: string
}

interface StatusResponse {
  config: PublicConfig
  health: {
    ok?: boolean
    status?: number
    skipped?: boolean
    reason?: string
  }
}

export function activate(ctx: WebPluginContext): void {
  ctx.panels.register({
    id: 'open-connector-settings',
    title: 'OpenConnector',
    location: 'sidebar',
    component: props => <OpenConnectorPanel {...props} routes={ctx.routes} />,
  })

  ctx.logger.info('OpenConnector plugin (web) activated')
}

function OpenConnectorPanel({
  isActive,
  routes,
}: {
  isActive: boolean
  routes: WebPluginContext['routes']
}) {
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [healthLabel, setHealthLabel] = useState('Unknown')
  const [baseUrl, setBaseUrl] = useState('')
  const [runtimeToken, setRuntimeToken] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await routes.fetch('/status')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json() as StatusResponse
      setConfig(data.config)
      setBaseUrl(data.config.baseUrl)
      setEnabled(data.config.enabled)
      setRuntimeToken('')

      if (data.health.skipped) {
        setHealthLabel('Disabled')
      }
      else if (data.health.ok) {
        setHealthLabel(`Healthy (${data.health.status ?? 200})`)
      }
      else {
        setHealthLabel(`Unreachable (${data.health.status ?? 'error'})`)
      }
    }
    catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    finally {
      setLoading(false)
    }
  }, [routes])

  useEffect(() => {
    if (!isActive) {
      return
    }
    void loadStatus()
  }, [isActive, loadStatus])

  async function saveConfig() {
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        baseUrl,
        enabled,
      }
      if (runtimeToken.trim()) {
        payload.runtimeToken = runtimeToken.trim()
      }

      const response = await routes.fetch('/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      await loadStatus()
    }
    catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <header>
        <h2 style={{ margin: 0, fontSize: 16 }}>OpenConnector</h2>
        <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>
          Connect to a self-hosted OpenConnector runtime via MCP.
        </p>
      </header>

      <dl style={{ margin: 0, fontSize: 13 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <dt style={{ minWidth: 72, color: '#666' }}>Status</dt>
          <dd style={{ margin: 0 }}>{loading ? 'Loading…' : healthLabel}</dd>
        </div>
        {config && (
          <div style={{ display: 'flex', gap: 8 }}>
            <dt style={{ minWidth: 72, color: '#666' }}>MCP URL</dt>
            <dd style={{ margin: 0, fontFamily: 'monospace' }}>{config.mcpUrl}</dd>
          </div>
        )}
      </dl>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
        Base URL
        <input
          value={baseUrl}
          onChange={event => setBaseUrl(event.target.value)}
          placeholder="http://127.0.0.1:3000"
          style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #ccc' }}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
        Runtime token
        <input
          value={runtimeToken}
          onChange={event => setRuntimeToken(event.target.value)}
          placeholder={config?.hasRuntimeToken ? 'Saved (leave blank to keep)' : 'oct_...'}
          type="password"
          autoComplete="off"
          style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #ccc' }}
        />
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={event => setEnabled(event.target.checked)}
        />
        Enable MCP registration
      </label>

      {error && (
        <p role="alert" style={{ margin: 0, color: '#b00020', fontSize: 13 }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => void saveConfig()}
          disabled={saving}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc', cursor: 'pointer' }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => void loadStatus()}
          disabled={loading}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc', cursor: 'pointer' }}
        >
          Refresh
        </button>
        {baseUrl && (
          <a
            href={baseUrl}
            target="_blank"
            rel="noreferrer"
            style={{ alignSelf: 'center', fontSize: 13 }}
          >
            Open Console
          </a>
        )}
      </div>
    </div>
  )
}
