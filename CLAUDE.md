# chip

Personal Raycast extension that runs [che](https://github.com/codebend3r/che)
tools from Raycast. One command so far: **Sync All Branches**.

## Git policy — read this first

**Never commit, push, create a branch, or open a pull request in this repo unless
the user explicitly asks in that message.**

- Finish the work, leave it in the working tree, and say what changed.
- "Fix X", "add Y", "migrate Z" means edit the files. It does **not** imply a commit.
- Work on whatever branch is already checked out, including `main`. `main` is the
  normal place to work here.
- Do not cut a branch as a safety measure, a convention, or a prelude to a commit.
  If a change feels risky on `main`, do it anyway and say so afterwards.
- Skills that create branches (`creating-feature-branches`) do **not** apply here.
  This file overrides them.
- No `git push`, no `gh pr create`, no `git tag` without a direct instruction.

When the user does ask for a commit, follow `.claude/skills/commit-format/SKILL.md`
— subjects are prefixed `CHIP:`.

## Toolchain

| Thing           | Value                                     |
| --------------- | ----------------------------------------- |
| Runtime         | Node 24 (`.node-version`, `engines.node`) |
| Package manager | bun (`bun.lock`) — never `npm install`    |
| Versions        | exact — no `^`, no `~`, no ranges         |
| Lint            | `oxlint` (`.oxlintrc.json`)               |
| Format          | `oxfmt` (`.oxfmtrc.json`), 120 columns    |
| Language        | TypeScript, strict, `react-jsx` runtime   |

```sh
bun install
bun run dev        # ray develop — imports into Raycast, hot reloads
bun run build      # ray build -e dist, type-checks
bun run lint       # oxlint && oxfmt --check
bun run fix-lint   # oxlint --fix && oxfmt
```

There is no test suite. `bun run lint && bun run build` is the full check.

Every entry in `dependencies` and `devDependencies` is an exact version. `bunfig.toml`
sets `install.exact`, so `bun add` writes `1.2.3` and never `^1.2.3` — do not widen a
pin back into a range, and do not hand-edit one in.

## Layout

| File                        | Role                                                          |
| --------------------------- | ------------------------------------------------------------- |
| `src/sync-all-branches.tsx` | Command entry. `List` of repos, actions push `RunView`.       |
| `src/run-view.tsx`          | `Detail` view. Streams output, toasts on finish.              |
| `src/lib/repos.ts`          | `findRepos()` — scans the root 2 levels deep for main clones. |
| `src/lib/che.ts`            | `resolveChe()` — locates che's home, python, and script.      |
| `src/lib/runner.ts`         | `useSyncRunner()` — spawns the script, streams stdout/stderr. |

`raycast-env.d.ts` and `dist/` are generated and gitignored. `ray build` rewrites
`raycast-env.d.ts` from the `preferences` and `commands` blocks in `package.json`
— edit the manifest, not the generated file.

## Behavior worth knowing

- **This extension deletes things.** `sync-all-branches.py` deletes local branches
  and removes worktrees. `src/lib/runner.ts` and `src/lib/che.ts` decide which
  script runs, under which interpreter, and whether `--dry-run` is passed. Treat
  changes there as destructive-path changes.
- `dryRun` is passed two ways: as `--dry-run` on the argv and as the `DRY_RUN` env
  var. Keep both in sync.
- Raycast launches node with a bare `PATH`, so `runner.ts` prepends `EXTRA_PATH`
  to reach `git` and `python3`. Removing it breaks the extension at runtime only,
  never at build time.
- `che.ts` reads `CHE_HOME` and `CHE_PYTHON` out of `~/.zshrc` when the matching
  preference is empty, so the extension follows whatever `che install` wrote.
- `findRepos()` skips linked worktrees on purpose — the sync script runs from the
  main clone and handles its own worktrees.
- Two `oxlint-disable-next-line` comments in `run-view.tsx` and `runner.ts` mark
  intentional effect patterns. Do not "fix" them into the dependency arrays.

## Raycast notes

- Commands and preferences are declared in `package.json`, not in code.
- `mode: "view"` commands must default-export a React component.
- Publishing to the Raycast Store would require an ESLint config, which this repo
  no longer has. That is deliberate; it is a personal extension.
