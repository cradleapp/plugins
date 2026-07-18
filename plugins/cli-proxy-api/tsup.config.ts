import { createPluginTsupConfig } from '../../tooling/create-plugin-tsup-config.js'
import { defineConfig } from 'tsup'

export default defineConfig(createPluginTsupConfig({ web: true }))
