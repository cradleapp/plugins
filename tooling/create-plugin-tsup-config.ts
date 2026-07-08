import type { Options } from 'tsup'
import { defineConfig } from 'tsup'

export interface CreatePluginTsupOptions {
  /** Include a browser web entry (`src/web.tsx`). */
  web?: boolean
}

/**
 * Shared tsup config for Cradle official plugins.
 * Produces ESM bundles consumed by the Cradle plugin host (`dist/server.mjs`, optional `dist/web.mjs`).
 */
export function createPluginTsupConfig(options: CreatePluginTsupOptions = {}): Options {
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
    outExtension: () => ({ js: '.mjs' }),
    target: 'es2022',
    platform: 'neutral',
    sourcemap: true,
    clean: true,
    dts: false,
    splitting: false,
    treeshake: true,
    minify: false,
    external: [
      /^node:/,
      '@cradle/plugin-sdk/server',
      '@cradle/plugin-sdk/web',
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
    ],
    esbuildOptions(esbuildOptions) {
      esbuildOptions.jsx = 'automatic'
    },
  }
}

export function definePluginTsupConfig(options: CreatePluginTsupOptions = {}) {
  return defineConfig(createPluginTsupConfig(options))
}
