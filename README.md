# Chip

Personal Raycast extension. Runs [che](https://github.com/codebend3r/che) tools from Raycast.

## Commands

| Command           | What it does                                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sync All Branches | Pick a repo under `~/Developer/git`, then run che's `sync-all-branches.py` in it. Output streams into a Detail view. `cmd+shift+enter` runs a dry run instead. |

## Preferences

All optional. Leave them empty to follow the che install block in `~/.zshrc`.

| Preference         | Default                                                      |
| ------------------ | ------------------------------------------------------------ |
| Repos Root         | `~/Developer/git`                                            |
| che Home           | `CHE_HOME` from `~/.zshrc`, else `~/Developer/git/che`       |
| Python Interpreter | `CHE_PYTHON` from `~/.zshrc`, else the first `python3` found |

## Development

```sh
cd ~/chip          # fnm picks up .node-version and switches to node 24
bun install
bun run dev        # imports the extension into Raycast and hot reloads on save
```

While `bun run dev` runs, open Raycast and search for "Sync All Branches". Stop the
dev server with `ctrl+c`; the extension stays installed until you remove it from
Raycast's Extensions settings.

Other scripts:

```sh
bun run build      # type-check and bundle into dist/
bun run lint       # oxlint + oxfmt --check
bun run fix-lint   # oxlint --fix + oxfmt
```
