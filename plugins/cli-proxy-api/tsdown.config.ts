import { createPluginTsdownConfig } from '../../tooling/create-plugin-tsdown-config.ts'
import { defineConfig } from 'tsdown'

export default defineConfig(createPluginTsdownConfig({ web: true }))
