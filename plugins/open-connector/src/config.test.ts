import { describe, expect, it } from 'vitest'

import { buildHealthUrl, buildMcpUrl } from './config'

describe('open-connector config helpers', () => {
  it('builds MCP and health URLs from base URL', () => {
    expect(buildMcpUrl('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000/mcp')
    expect(buildHealthUrl('http://127.0.0.1:3000/')).toBe('http://127.0.0.1:3000/health')
  })
})
