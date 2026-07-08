import type { ServerPluginContext } from '@cradle/plugin-sdk/server'
import { z } from 'zod'

export const DEFAULT_OPENCONNECTOR_BASE_URL = 'http://127.0.0.1:3000'

const CONFIG_STORAGE_KEY = 'config'

const StoredConfigSchema = z.object({
  baseUrl: z.string().trim().optional(),
  runtimeToken: z.string().trim().optional(),
  enabled: z.boolean().optional(),
})

const ConfigUpdateSchema = z.object({
  baseUrl: z.string().trim().optional(),
  runtimeToken: z.string().trim().nullable().optional(),
  enabled: z.boolean().optional(),
})

export interface OpenConnectorPluginConfig {
  baseUrl: string
  enabled: boolean
}

export interface OpenConnectorResolvedConfig extends OpenConnectorPluginConfig {
  runtimeToken?: string
  hasRuntimeToken: boolean
  mcpUrl: string
}

export interface PublicOpenConnectorPluginConfig extends OpenConnectorPluginConfig {
  hasRuntimeToken: boolean
  mcpUrl: string
}

export function projectPublicConfig(config: OpenConnectorResolvedConfig): PublicOpenConnectorPluginConfig {
  return {
    baseUrl: config.baseUrl,
    enabled: config.enabled,
    hasRuntimeToken: config.hasRuntimeToken,
    mcpUrl: config.mcpUrl,
  }
}

export async function readOpenConnectorPluginConfig(ctx: ServerPluginContext): Promise<OpenConnectorResolvedConfig> {
  const stored = await readStoredConfig(ctx)
  const baseUrl = normalizeBaseUrl(stored.baseUrl ?? DEFAULT_OPENCONNECTOR_BASE_URL)
  const runtimeToken = normalizeOptionalString(stored.runtimeToken)

  return {
    baseUrl,
    enabled: stored.enabled ?? true,
    runtimeToken,
    hasRuntimeToken: !!runtimeToken,
    mcpUrl: buildMcpUrl(baseUrl),
  }
}

export async function writeOpenConnectorPluginConfig(
  ctx: ServerPluginContext,
  input: z.infer<typeof ConfigUpdateSchema>,
): Promise<OpenConnectorResolvedConfig> {
  const parsed = ConfigUpdateSchema.parse(input)
  const current = await readStoredConfig(ctx)

  const next = StoredConfigSchema.parse({
    ...current,
    ...(parsed.baseUrl !== undefined ? { baseUrl: parsed.baseUrl } : {}),
    ...(parsed.enabled !== undefined ? { enabled: parsed.enabled } : {}),
    ...(parsed.runtimeToken !== undefined
      ? { runtimeToken: parsed.runtimeToken ?? undefined }
      : {}),
  })

  await ctx.storage.set(CONFIG_STORAGE_KEY, JSON.stringify(next))
  return readOpenConnectorPluginConfig(ctx)
}

async function readStoredConfig(ctx: ServerPluginContext): Promise<z.infer<typeof StoredConfigSchema>> {
  const raw = await ctx.storage.get(CONFIG_STORAGE_KEY)
  if (!raw) {
    return {}
  }

  try {
    return StoredConfigSchema.parse(JSON.parse(raw))
  }
  catch {
    return {}
  }
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//.test(trimmed)) {
    throw new Error('OpenConnector base URL must start with http:// or https://.')
  }
  return trimmed
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

export function buildMcpUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/mcp`
}

export function buildHealthUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/health`
}
