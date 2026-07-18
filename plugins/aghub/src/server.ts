import type { ServerPluginContext } from '@cradle/plugin-sdk/server'

import { createAghubExternalProviderSource } from './source'

export function activate(ctx: ServerPluginContext): void {
  ctx.providers.externalSources.register(createAghubExternalProviderSource())
  ctx.logger.info('AGHub external provider source activated')
}
