# chip

Personal Raycast extension that runs [che](https://github.com/codebend3r/che)
tools from Raycast. One command so far: **Sync All Branches**.

## Git policy — read this first

**Never commit, push, branch, or open a PR unless the user asks in that message.**
"Fix X", "add Y" means edit the files and leave them in the working tree. Work on
whatever branch is checked out, including `main` — that is the normal place to work
here. `creating-feature-branches` does not apply; this file overrides it.

When a commit is asked for, follow `.claude/skills/commit-format/SKILL.md` — subjects
are prefixed `CHIP:`.

## Toolchain

Node 24, bun (never `npm install`), TypeScript strict with `react-jsx`, `oxlint` +
`oxfmt` at 120 columns.

```sh
bun run dev        # ray develop — imports into Raycast, hot reloads
bun run build      # ray build -e dist, type-checks
bun run lint       # oxlint && oxfmt --check
bun run fix-lint   # oxlint --fix && oxfmt
```

No test suite. `bun run lint && bun run build` is the full check.

Every dependency is pinned exact — `bunfig.toml` sets `install.exact`. Never widen a
pin into a range.

## Layout

| File                        | Role                                                          |
| --------------------------- | ------------------------------------------------------------- |
| `src/sync-all-branches.tsx` | Command entry. `List` of repos, actions push `RunView`.       |
| `src/run-view.tsx`          | `Detail` view. Streams output, toasts on finish.              |
| `src/lib/repos.ts`          | `findRepos()` — scans the root 2 levels deep for main clones. |
| `src/lib/che.ts`            | `resolveChe()` — locates che's home, python, and script.      |
| `src/lib/runner.ts`         | `useSyncRunner()` — spawns the script, streams stdout/stderr. |

`raycast-env.d.ts` and `dist/` are generated and gitignored — edit `package.json`,
not the generated file.

## React

- Never use default exports if it can be avoided, prefer named exports. The one
  exception is a `mode: "view"` command entry, which Raycast requires to
  default-export a React component.
- Always import all React methods, constants, and types from `react`, e.g.
  `import { useState } from 'react'`
- Prefer using latest features in React when possible
- Prefer using the `use` hook pattern for state management
- Prefer using zustand always for global state management

## Typescript

- Always use type aliases. Never use TypeScript interfaces anywhere, including
  `declare global` augmentations
- Use type guards wherever possible.
- Unit test all type guard functions
- Never use `any` types; prefer type narrowing or type guards
- Never under any circumstance cast types and never double cast: `as any as string`
- If type can't be inferred and type narrowing is not an option, use `unknown` types

## SCSS/CSS

- Use SCSS modules (`*.module.scss`) for component styles
- Only use global stylesheets (`styles/globals.scss`) for design tokens and true
  typographic primitives
- Use a container driven approach, meaning the container will define the width and
  height and the children will be positioned within it, this means if/when the
  children are moved to different containers they may be laid out differently
  depending on what the container specifies
- Prefer using CSS display grid for layout with the gap property for spacing between
  grid items; avoid using margins for spacing
- Second preferred display value is flex
- Avoid using plain divs; meaning divs with no class or id defined
- Always use token values from `styles/globals.scss` when defining font sizes,
  colors, and other design tokens like padding, margin, gap, and border radius

## Code style

- Always prefer immutable data structures and operations
- Prefer `reduce` over `for` loops when possible. Never use `for/in` or `for/of`
  loops; reach for `Array.prototype` methods (`map`, `filter`, `reduce`, `flatMap`,
  etc.) when the value is an array.
- Prefer double-bang (`!!value`) for boolean conversion.
- Prefer short-circuit (`&&`) over a ternary when the else branch is `null` or
  `undefined`, especially in React rendering. Do: `{isActive && <Badge />}`. Don't:
  `{isActive ? <Badge /> : null}`. Guard the condition so it is a real boolean
  (`!!count && ...`), never a bare number that could render `0`.
- Prefer optional chaining (`?.`). When optional chaining is used, ALWAYS pair it
  with nullish coalescing (`??`) to supply a fallback.
- Prefer a single configurable object parameter over multiple positional parameters
  so argument order doesn't matter. Don't: `doSomething(foo, bar, hello)`. Do:
  `doSomething({ foo, bar, hello })`.

## Gotchas

- **This extension deletes things.** `sync-all-branches.py` deletes local branches
  and removes worktrees. Treat `runner.ts` and `che.ts` as destructive-path changes.
- `dryRun` is passed twice — `--dry-run` on the argv and the `DRY_RUN` env var. Keep
  both in sync.
- Raycast launches node with a bare `PATH`, so `runner.ts` prepends `EXTRA_PATH` to
  reach `git` and `python3`. Removing it breaks the extension at runtime only.
- `che.ts` reads `CHE_HOME` and `CHE_PYTHON` out of `~/.zshrc` when the matching
  preference is empty.
- `findRepos()` skips linked worktrees on purpose.
- The `oxlint-disable-next-line` comments in `run-view.tsx` and `runner.ts` are
  intentional effect patterns. Do not "fix" them into the dependency arrays.
- Commands and preferences are declared in `package.json`, not in code.
- No ESLint config, so the Raycast Store is off the table. Deliberate.
