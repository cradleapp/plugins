import type { Disposable, ServerPluginContext, ServerPluginRouteContext } from '@cradle/plugin-sdk/server'
import { z } from 'zod'

import {
  buildHealthUrl,
  projectPublicConfig,
  readOpenConnectorPluginConfig,
  writeOpenConnectorPluginConfig,
} from './config'

let activeMcpRegistration: Disposable | undefined

export async function activate(ctx: ServerPluginContext): Promise<void> {
  registerOpenConnectorRoutes(ctx)
  await syncOpenConnectorMcpServer(ctx)
  ctx.logger.info('OpenConnector plugin activated')
}

export async function deactivate(): Promise<void> {
  activeMcpRegistration?.dispose()
  activeMcpRegistration = undefined
}

async function syncOpenConnectorMcpServer(ctx: ServerPluginContext): Promise<void> {
  activeMcpRegistration?.dispose()
  activeMcpRegistration = undefined

  const config = await readOpenConnectorPluginConfig(ctx)
  if (!config.enabled) {
    return
  }

  activeMcpRegistration = await ctx.mcp.registerServer({
    transport: 'streamable-http',
    name: 'open-connector',
    url: config.mcpUrl,
    ...(config.runtimeToken
      ? { headers: { Authorization: `Bearer ${config.runtimeToken}` } }
      : {}),
  })
}

function registerOpenConnectorRoutes(ctx: ServerPluginContext): void {
  ctx.routes.register({
    method: 'GET',
    path: '/status',
    label: 'OpenConnector status',
    handler: async (routeCtx) => {
      const config = await readOpenConnectorPluginConfig(ctx)
      if (!config.enabled) {
        return ok({
          config: projectPublicConfig(config),
          health: { skipped: true, reason: 'plugin_disabled' },
        })
      }

      try {
        const response = await fetch(buildHealthUrl(config.baseUrl), {
          headers: config.runtimeToken
            ? { Authorization: `Bearer ${config.runtimeToken}` }
            : undefined,
        })

        return ok({
          config: projectPublicConfig(config),
          health: {
            ok: response.ok,
            status: response.status,
          },
        })
      }
      catch (error) {
        return fail(routeCtx, error)
      }
    },
  })

  ctx.routes.register({
    method: 'GET',
    path: '/config',
    label: 'OpenConnector config',
    handler: async () => {
      const config = await readOpenConnectorPluginConfig(ctx)
      return ok({ config: projectPublicConfig(config) })
    },
  })

  ctx.routes.register({
    method: 'PUT',
    path: '/config',
    label: 'OpenConnector config',
    handler: async (routeCtx) => {
      try {
        const body = ConfigUpdateBodySchema.parse(routeCtx.body)
        const config = await writeOpenConnectorPluginConfig(ctx, body)
        await syncOpenConnectorMcpServer(ctx)
        return ok({ config: projectPublicConfig(config) })
      }
      catch (error) {
        return fail(routeCtx, error)
      }
    },
  })
}

const ConfigUpdateBodySchema = z.object({
  baseUrl: z.string().trim().optional(),
  runtimeToken: z.string().trim().nullable().optional(),
  enabled: z.boolean().optional(),
})

function ok<T>(data: T): T {
  return data
}

function fail(routeCtx: ServerPluginRouteContext, error: unknown) {
  routeCtx.set.status = 500
  return {
    error: error instanceof Error ? error.message : String(error),
  }
}
