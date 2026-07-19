import type { UserConfig } from 'tsdown'
import { defineConfig } from 'tsdown'

export interface CreatePluginTsdownOptions {
  /** Include a browser web entry (`src/web.tsx`). */
  web?: boolean
}

/**
 * Shared tsdown config for Cradle official plugins.
 * Produces ESM bundles consumed by the Cradle plugin host (`dist/server.mjs`, optional `dist/web.mjs`).
 * @see https://tsdown.dev/
 */
export function createPluginTsdownConfig(options: CreatePluginTsdownOptions = {}): UserConfig {
  const entry: Record<string, string> = {
    server: 'src/server.ts',
  }

  if (options.web) {
    entry.web = 'src/web.tsx'
  }

  return {
    entry,
    format: ['esm'],
    outDir: 'dist',
    outExtensions: () => ({ js: '.mjs' }),
    target: 'es2022',
    platform: 'neutral',
    sourcemap: true,
    clean: true,
    dts: false,
    hash: false,
    treeshake: true,
    minify: false,
    deps: {
      neverBundle: [
        /^node:/,
        '@cradle/plugin-sdk/server',
        '@cradle/plugin-sdk/web',
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
      ],
    },
  }
}

export function definePluginTsdownConfig(options: CreatePluginTsdownOptions = {}) {
  return defineConfig(createPluginTsdownConfig(options))
}
