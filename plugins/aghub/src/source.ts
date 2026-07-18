/* Reads AGHub's provider inventory into Cradle's host-rendered external-provider UI. */

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'

import type {
  ExternalProviderCredential,
  ExternalProviderRecord,
  ExternalProviderSource,
  ExternalProviderSourceReadContext,
  ExternalProviderSourceSnapshot,
  ExternalProviderWarning,
} from '@cradle/plugin-sdk/server'
import Database from 'better-sqlite3'
import { z } from 'zod'

const INFERENCE_PROVIDERS_FILE = 'inference_providers.db'

const ProviderFormatSchema = z.enum([
  'anthropic',
  'openai_completions',
  'openai_responses',
])

const AghubProviderSchema = z.object({
  id: z.string().trim().min(1),
  latin_name: z.string().trim().min(1),
  display_name: z.string().trim().min(1),
  format: ProviderFormatSchema,
  api_base_url: z.string().trim().min(1),
  preset: z.string().nullable(),
  masked_api_key: z.string(),
  models: z.array(z.string().trim().min(1)),
})

const AghubDatabaseProviderRowSchema = AghubProviderSchema.omit({ models: true })

const AghubModelRowSchema = z.object({
  provider_id: z.string().trim().min(1),
  name: z.string().trim().min(1),
})

const AghubApiProviderSchema = AghubProviderSchema

const AghubApiPasswordSchema = z.object({
  latin_name: z.string().trim().min(1),
  api_key: z.string().trim().min(1),
})

type AghubProvider = z.infer<typeof AghubProviderSchema>

interface AghubSourceConfig {
  databasePath: string
  apiBaseUrl?: string
  apiToken?: string
}

interface AghubApiSnapshot {
  providers: AghubProvider[]
  credentials: Map<string, ExternalProviderCredential>
  warnings: ExternalProviderWarning[]
}

function warningMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function configValue(ctx: ExternalProviderSourceReadContext | null, key: string): string | undefined {
  const value = ctx?.sharedConfig.get(key)
    ?? process.env[`CRADLE_${key}`]
    ?? process.env[key]
  const trimmed = value?.trim()
  return trimmed || undefined
}

function defaultAghubDataDir(): string {
  if (platform() === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'com.akrc.aghub')
  }

  if (platform() === 'win32') {
    return join(process.env.APPDATA?.trim() || join(homedir(), 'AppData', 'Roaming'), 'aghub')
  }

  return join(process.env.XDG_DATA_HOME?.trim() || join(homedir(), '.local', 'share'), 'aghub')
}

function normalizeApiBaseUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('AGHub API URL must start with http:// or https://.')
  }
  return value.replace(/\/+$/, '')
}

export function resolveAghubSourceConfig(
  ctx: ExternalProviderSourceReadContext | null = null,
): AghubSourceConfig {
  const dataDir = configValue(ctx, 'AGHUB_DATA_DIR') ?? defaultAghubDataDir()
  const apiBaseUrl = normalizeApiBaseUrl(configValue(ctx, 'AGHUB_API_URL'))
  const apiToken = configValue(ctx, 'AGHUB_API_TOKEN')

  if (apiBaseUrl && !apiToken) {
    throw new Error('Set both AGHUB_API_URL and AGHUB_API_TOKEN to import AGHub API keys.')
  }

  return {
    databasePath: configValue(ctx, 'AGHUB_DATABASE_PATH') ?? join(dataDir, INFERENCE_PROVIDERS_FILE),
    apiBaseUrl,
    ...(apiBaseUrl && apiToken ? { apiToken } : {}),
  }
}

function tableExists(database: Database.Database, tableName: string): boolean {
  return Boolean(database
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .get(tableName))
}

function tableColumns(database: Database.Database, tableName: string): Set<string> {
  const rows = database.prepare(`PRAGMA table_info(${tableName})`).all()
  return new Set(z.array(z.object({ name: z.string() })).parse(rows).map(row => row.name))
}

function selectedColumn(
  columns: Set<string>,
  candidates: readonly string[],
  alias: string,
  fallback: string,
): string {
  const column = candidates.find(candidate => columns.has(candidate))
  return column ? `${column} AS ${alias}` : `${fallback} AS ${alias}`
}

export function readAghubDatabaseProviders(databasePath: string): AghubProvider[] {
  if (!existsSync(databasePath)) {
    throw new Error(`AGHub provider database was not found at ${databasePath}`)
  }

  const database = new Database(databasePath, { readonly: true, fileMustExist: true })
  try {
    database.pragma('query_only = ON')
    database.pragma('busy_timeout = 1000')

    if (!tableExists(database, 'inference_providers')) {
      throw new Error('AGHub provider database is missing the inference_providers table')
    }

    const columns = tableColumns(database, 'inference_providers')
    for (const column of ['id', 'format', 'api_base_url']) {
      if (!columns.has(column)) {
        throw new Error(`AGHub inference_providers table is missing required column ${column}`)
      }
    }

    const rows = database.prepare(`
      SELECT
        id,
        ${selectedColumn(columns, ['latin_name', 'name'], 'latin_name', 'id')},
        ${selectedColumn(columns, ['display_name'], 'display_name', 'id')},
        format,
        api_base_url,
        ${selectedColumn(columns, ['preset'], 'preset', 'NULL')},
        ${selectedColumn(columns, ['masked_api_key'], 'masked_api_key', "''")}
      FROM inference_providers
      ORDER BY rowid ASC
    `).all()

    const providers = z.array(AghubDatabaseProviderRowSchema).parse(rows)
    const modelsByProvider = new Map<string, string[]>()
    if (tableExists(database, 'inference_models')) {
      const modelRows = z.array(AghubModelRowSchema).parse(database
        .prepare('SELECT provider_id, name FROM inference_models ORDER BY rowid ASC')
        .all())
      for (const model of modelRows) {
        const models = modelsByProvider.get(model.provider_id) ?? []
        models.push(model.name)
        modelsByProvider.set(model.provider_id, models)
      }
    }

    return providers.map(provider => ({
      ...provider,
      models: modelsByProvider.get(provider.id) ?? [],
    }))
  }
  finally {
    database.close()
  }
}

function apiUrl(baseUrl: string, path: string): string {
  return `${baseUrl}/${path.replace(/^\/+/, '')}`
}

async function fetchAghubApiJson<T>(
  url: string,
  token: string,
  signal: AbortSignal,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })
  if (!response.ok) {
    throw new Error(`AGHub API request failed with HTTP ${response.status}`)
  }
  return schema.parse(await response.json())
}

async function readAghubApiSnapshot(
  config: Required<Pick<AghubSourceConfig, 'apiBaseUrl' | 'apiToken'>>,
  signal: AbortSignal,
): Promise<AghubApiSnapshot> {
  const providers = await fetchAghubApiJson(
    apiUrl(config.apiBaseUrl, 'inference/providers'),
    config.apiToken,
    signal,
    z.array(AghubApiProviderSchema),
  )
  const credentials = new Map<string, ExternalProviderCredential>()
  const warnings: ExternalProviderWarning[] = []

  for (const provider of providers) {
    try {
      const password = await fetchAghubApiJson(
        apiUrl(config.apiBaseUrl, `inference/providers/${encodeURIComponent(provider.latin_name)}/password`),
        config.apiToken,
        signal,
        AghubApiPasswordSchema,
      )
      credentials.set(provider.id, {
        kind: 'api-key',
        value: password.api_key,
        label: provider.display_name,
      })
    }
    catch (error) {
      warnings.push({
        code: 'aghub-api-key-unavailable',
        message: `AGHub API could not read the key for ${provider.display_name}. ${warningMessage(error)}`,
        severity: 'warning',
      })
    }
  }

  return { providers, credentials, warnings }
}

function providerKind(provider: AghubProvider): 'anthropic' | 'openai-compatible' {
  return provider.format === 'anthropic' ? 'anthropic' : 'openai-compatible'
}

function providerApiMode(provider: AghubProvider): 'responses' | 'chat-completions' | undefined {
  if (provider.format === 'openai_responses') {
    return 'responses'
  }
  if (provider.format === 'openai_completions') {
    return 'chat-completions'
  }
  return undefined
}

function fingerprintHint(provider: AghubProvider): string {
  return createHash('sha256').update(JSON.stringify({
    id: provider.id,
    latinName: provider.latin_name,
    displayName: provider.display_name,
    format: provider.format,
    baseUrl: provider.api_base_url,
    preset: provider.preset,
    models: provider.models,
  })).digest('hex')
}

function toExternalProviderRecord(
  provider: AghubProvider,
  credential: ExternalProviderCredential | undefined,
): ExternalProviderRecord {
  const model = provider.models[0]
  const apiMode = providerApiMode(provider)
  return {
    externalId: `aghub:${provider.id}`,
    app: 'aghub',
    name: provider.display_name,
    providerKind: providerKind(provider),
    config: {
      baseUrl: provider.api_base_url,
      ...(model ? { model } : {}),
      ...(apiMode ? { apiMode } : {}),
    },
    ...(credential ? { credential } : {}),
    metadata: {
      baseUrl: provider.api_base_url,
      ...(model ? { model } : {}),
      apiFormat: provider.format,
      rawFingerprintHint: fingerprintHint(provider),
    },
  }
}

function sourceStatus(warnings: ExternalProviderWarning[]): 'ok' | 'warning' | 'error' {
  if (warnings.some(warning => warning.severity === 'error')) {
    return 'error'
  }
  return warnings.some(warning => warning.severity === 'warning') ? 'warning' : 'ok'
}

export async function readAghubExternalProviderSnapshot(
  ctx: ExternalProviderSourceReadContext,
): Promise<ExternalProviderSourceSnapshot> {
  const config = resolveAghubSourceConfig(ctx)
  const warnings: ExternalProviderWarning[] = []
  let databaseProviders: AghubProvider[] | undefined
  let apiSnapshot: AghubApiSnapshot | undefined

  try {
    databaseProviders = readAghubDatabaseProviders(config.databasePath)
  }
  catch (error) {
    warnings.push({
      code: 'aghub-database-unavailable',
      message: warningMessage(error),
      severity: 'warning',
    })
  }

  if (config.apiBaseUrl && config.apiToken) {
    try {
      apiSnapshot = await readAghubApiSnapshot({
        apiBaseUrl: config.apiBaseUrl,
        apiToken: config.apiToken,
      }, ctx.signal)
      warnings.push(...apiSnapshot.warnings)
    }
    catch (error) {
      warnings.push({
        code: 'aghub-api-unavailable',
        message: `Could not read AGHub's configured API. Falling back to local metadata when available. ${warningMessage(error)}`,
        severity: 'warning',
      })
    }
  }

  const providers = apiSnapshot?.providers ?? databaseProviders
  if (!providers) {
    throw new Error(`AGHub could not be read. ${warnings.map(warning => warning.message).join(' ')}`)
  }

  if (!apiSnapshot) {
    warnings.push({
      code: 'aghub-api-key-not-imported',
      message: 'AGHub keeps API keys in your operating-system keychain. Configure AGHUB_API_URL and AGHUB_API_TOKEN to import them into Cradle securely.',
      severity: 'warning',
    })
  }

  return {
    source: {
      status: sourceStatus(warnings),
      message: apiSnapshot
        ? `Read ${providers.length} AGHub providers and their available API keys.`
        : `Read ${providers.length} AGHub providers from ${config.databasePath}.`,
      observedAt: new Date().toISOString(),
    },
    providers: providers.map(provider => toExternalProviderRecord(
      provider,
      apiSnapshot?.credentials.get(provider.id),
    )),
    warnings,
  }
}

export function createAghubExternalProviderSource(): ExternalProviderSource {
  return {
    id: 'aghub',
    label: 'AGHub',
    description: 'Reads AGHub inference providers and mirrors them as Cradle external providers.',
    capabilities: { refresh: true, revealSourceFile: true },
    readSnapshot: readAghubExternalProviderSnapshot,
  }
}
