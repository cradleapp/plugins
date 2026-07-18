# @cradleapp/aghub

Bring the model providers you already manage in [AGHub](https://github.com/akarachen/aghub) into Cradle. Install this plugin, refresh the **AGHub** source in Cradle’s provider settings, then choose an imported provider like any other Cradle model provider.

The plugin is read-only: it never changes AGHub settings, its database, or your operating-system keychain.

## What gets imported

- Every provider you created in AGHub, including its display name, endpoint, API format, and default model
- Anthropic Messages providers as Cradle Anthropic providers
- OpenAI Chat Completions and OpenAI Responses providers as Cradle OpenAI-compatible providers; the correct API mode is preserved
- The AGHub app icon is bundled with the plugin for Cradle’s plugin surfaces

## API keys and privacy

AGHub deliberately stores API keys in your operating system’s keychain, not in `inference_providers.db`. For that reason the default local-database import does **not** copy a key out of the keychain.

To make an imported provider immediately usable, use an AGHub API instance you control and provide both of these values to the Cradle plugin environment/configuration:

| Setting | Example | Purpose |
| --- | --- | --- |
| `AGHUB_API_URL` | `http://127.0.0.1:9688/api/v1` | The complete base URL of the AGHub API. |
| `AGHUB_API_TOKEN` | `…` | The bearer token for that specific local API session. |

When both are present, the plugin fetches each key from AGHub’s authenticated API and hands it to Cradle’s encrypted credential store. The key is never put in the provider configuration, plugin storage, logs, or this repository. If the API is not available, the provider remains visible in Cradle and the source explains that credentials were not imported.

## Where provider metadata is read from

By default the plugin reads AGHub’s own data directory:

- macOS: `~/Library/Application Support/aghub/inference_providers.db`
- Linux: `${XDG_DATA_HOME:-~/.local/share}/aghub/inference_providers.db`
- Windows: `%APPDATA%\\aghub\\inference_providers.db`

Use `AGHUB_DATA_DIR` to point at a different AGHub data directory, or `AGHUB_DATABASE_PATH` to select the database file directly. These options are useful for portable installs and development builds.

## Notes on AGHub features

AGHub also manages MCP servers, skills, agent configuration, and Claude Code plugins. This plugin intentionally focuses on model providers: Cradle’s external-provider-source contract owns a read-only provider snapshot and does not allow the plugin to mutate AGHub or replace Cradle’s provider UI.

AGHub’s full per-provider model list is detected by the source. Cradle’s current external-provider-source API can bootstrap one default model and then discovers the rest from the provider endpoint when credentials are available; it does not yet offer a host-owned field for a plugin to push AGHub’s complete model list into Cradle’s model picker. The README documents this so a future host extension can add it without changing the AGHub source format.

## Development

```bash
pnpm --filter @cradleapp/aghub build
pnpm --filter @cradleapp/aghub test
```
