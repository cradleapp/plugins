import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import Database from 'better-sqlite3'
import type { ExternalProviderSourceReadContext } from '@cradle/plugin-sdk/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  readAghubDatabaseProviders,
  readAghubExternalProviderSnapshot,
  resolveAghubSourceConfig,
} from './source'

const temporaryDirectories: string[] = []
const originalFetch = globalThis.fetch

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
  globalThis.fetch = originalFetch
})

describe('AGHub provider source', () => {
  it('reads all provider formats and their models from AGHub metadata', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cradle-aghub-'))
    temporaryDirectories.push(directory)
    const databasePath = join(directory, 'inference_providers.db')
    const database = new Database(databasePath)
    database.exec(`
      CREATE TABLE inference_providers (
        id TEXT PRIMARY KEY NOT NULL,
        latin_name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        format TEXT NOT NULL,
        api_base_url TEXT NOT NULL,
        preset TEXT,
        masked_api_key TEXT NOT NULL
      );
      CREATE TABLE inference_models (
        provider_id TEXT NOT NULL,
        name TEXT NOT NULL
      );
    `)
    database.prepare(`
      INSERT INTO inference_providers
        (id, latin_name, display_name, format, api_base_url, preset, masked_api_key)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('provider-1', 'gateway', 'My Gateway', 'openai_responses', 'https://gateway.example.test/v1', 'openrouter', 'sk-…1234')
    database.prepare('INSERT INTO inference_models (provider_id, name) VALUES (?, ?)')
      .run('provider-1', 'gpt-5')
    database.close()

    expect(readAghubDatabaseProviders(databasePath)).toEqual([{
      id: 'provider-1',
      latin_name: 'gateway',
      display_name: 'My Gateway',
      format: 'openai_responses',
      api_base_url: 'https://gateway.example.test/v1',
      preset: 'openrouter',
      masked_api_key: 'sk-…1234',
      models: ['gpt-5'],
    }])
  })

  it('requires the API URL and token together', () => {
    const previousUrl = process.env.AGHUB_API_URL
    const previousToken = process.env.AGHUB_API_TOKEN
    process.env.AGHUB_API_URL = 'http://127.0.0.1:9688/api/v1'
    delete process.env.AGHUB_API_TOKEN

    expect(() => resolveAghubSourceConfig()).toThrow('Set both AGHUB_API_URL and AGHUB_API_TOKEN')

    if (previousUrl === undefined) {
      delete process.env.AGHUB_API_URL
    }
    else {
      process.env.AGHUB_API_URL = previousUrl
    }
    if (previousToken === undefined) {
      delete process.env.AGHUB_API_TOKEN
    }
    else {
      process.env.AGHUB_API_TOKEN = previousToken
    }
  })

  it('uses the authenticated AGHub API to import a key and preserve Responses mode', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'cradle-aghub-'))
    temporaryDirectories.push(directory)
    const databasePath = join(directory, 'inference_providers.db')
    const database = new Database(databasePath)
    database.exec(`
      CREATE TABLE inference_providers (
        id TEXT PRIMARY KEY NOT NULL,
        latin_name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        format TEXT NOT NULL,
        api_base_url TEXT NOT NULL,
        preset TEXT,
        masked_api_key TEXT NOT NULL
      );
      CREATE TABLE inference_models (
        provider_id TEXT NOT NULL,
        name TEXT NOT NULL
      );
    `)
    database.close()

    globalThis.fetch = vi.fn(async input => {
      const url = String(input)
      if (url.endsWith('/inference/providers')) {
        return Response.json([{
          id: 'provider-2',
          latin_name: 'responses-gateway',
          display_name: 'Responses Gateway',
          format: 'openai_responses',
          api_base_url: 'https://gateway.example.test/v1',
          preset: null,
          masked_api_key: 'sk-…5678',
          models: ['gpt-5.1'],
        }])
      }
      if (url.endsWith('/inference/providers/responses-gateway/password')) {
        return Response.json({ latin_name: 'responses-gateway', api_key: 'real-secret' })
      }
      return new Response(null, { status: 404 })
    }) as typeof fetch

    const context: ExternalProviderSourceReadContext = {
      signal: new AbortController().signal,
      logger: {
        info() {},
        warn() {},
        error() {},
        debug() {},
      },
      sharedConfig: new Map([
        ['AGHUB_DATABASE_PATH', databasePath],
        ['AGHUB_API_URL', 'http://127.0.0.1:9688/api/v1'],
        ['AGHUB_API_TOKEN', 'local-token'],
      ]),
    }

    const snapshot = await readAghubExternalProviderSnapshot(context)

    expect(snapshot.source.status).toBe('ok')
    expect(snapshot.providers).toEqual([expect.objectContaining({
      externalId: 'aghub:provider-2',
      providerKind: 'openai-compatible',
      config: {
        baseUrl: 'https://gateway.example.test/v1',
        model: 'gpt-5.1',
        apiMode: 'responses',
      },
      credential: {
        kind: 'api-key',
        value: 'real-secret',
        label: 'Responses Gateway',
      },
    })])
  })
})
