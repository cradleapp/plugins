# Cradle Official Plugins

Independent distribution repo for Cradle-maintained plugins that live outside `cradle-app`.

## Packages

| Package | Description |
|---------|-------------|
| `@cradleapp/open-connector` | Cradle Plugin for [OpenConnector](https://github.com/oomol-lab/open-connector) |
| `@cradleapp/aghub` | Mirrors [AGHub](https://github.com/akarachen/aghub) inference providers into Cradle |

## Development

With Cradle Desktop running and its CLI installed, enter a plugin package and run:

```sh
❯ cradle plugin dev

  ◆ Cradle v0.1.0 · plugin dev

┌  Your Plugin v0.0.1
│
◇  Ready in 53ms
│ ┌─Dev session────────────────────────┐
│ │  Server  http://127.0.0.1:21423    │
│ │  Layers  server rev 1 · web rev 1  │
│ │  Output  .cradle/dev               │
│ └────────────────────────────────────┘
│
●  Watching for changes. Press Ctrl+C to stop.
```

Packages declare explicit source entries in `package.json#cradle.dev`. The command uses Vite watch builds, temporarily activates the plugin in Desktop, reloads only successfully rebuilt layers, and removes the development session on Ctrl-C. Generated bundles stay under the ignored `.cradle/dev` directory; this workflow does not install or persist a plugin source.
