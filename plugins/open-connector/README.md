# @cradleapp/open-connector

Thin Cradle adapter for a self-hosted [OpenConnector](https://github.com/oomol-lab/open-connector) runtime.

## What it does

- Registers OpenConnector `/mcp` as a Cradle `streamable-http` MCP server
- Exposes plugin routes for config and health checks
- Provides a settings panel for base URL, runtime token, and enable/disable

Provider credentials stay inside OpenConnector. This plugin only stores the OpenConnector runtime URL and runtime token (`oct_...`).

## Build

```bash
pnpm --filter @cradle/open-connector build
```

## Configuration

| Field | Default | Description |
|-------|---------|-------------|
| `baseUrl` | `http://127.0.0.1:3000` | OpenConnector console/runtime base URL |
| `runtimeToken` | — | Bearer token for MCP access |
| `enabled` | `true` | Whether MCP registration is active |

## MVP checklist

1. Start OpenConnector locally (`docker compose up --build`)
2. Create a runtime token in the OpenConnector console
3. Add `cradle/official-plugins` as a Cradle git plugin source (`subPath: plugins`)
4. Grant trust + network permission for `@cradle/open-connector`
5. Configure base URL + token in the plugin panel
6. Confirm MCP tools such as `list_apps` and `execute_action` appear in the agent runtime
