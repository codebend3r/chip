import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";

export interface Repo {
  name: string;
  path: string;
  /** Path relative to the scanned root, for nested repos. */
  relativePath: string;
  /** Checked-out branch, or a short sha when detached. */
  branch: string | undefined;
}

const SKIP_DIRS = new Set(["node_modules", "dist", "build", "target", "vendor"]);

export function defaultReposRoot(): string {
  return join(homedir(), "Developer", "git");
}

type GitKind = "repo" | "worktree" | "none";

/** A `.git` directory marks a main clone; a `.git` file marks a linked worktree. */
function gitKind(dir: string): GitKind {
  try {
    return statSync(join(dir, ".git")).isDirectory() ? "repo" : "worktree";
  } catch {
    return "none";
  }
}

function currentBranch(dir: string): string | undefined {
  try {
    const head = readFileSync(join(dir, ".git", "HEAD"), "utf8").trim();
    const ref = head.match(/^ref: refs\/heads\/(.+)$/);
    return ref ? ref[1] : head.slice(0, 7);
  } catch {
    return undefined;
  }
}

/**
 * Find main clones under `root`, up to `depth` levels down. Linked worktrees
 * are skipped: sync-all-branches runs from the main clone and handles them.
 */
export function findRepos(root: string, depth = 2): Repo[] {
  const found: Repo[] = [];

  const walk = (dir: string, level: number) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      const kind = gitKind(full);
      if (kind === "repo") {
        found.push({ name: entry.name, path: full, relativePath: relative(root, full), branch: currentBranch(full) });
      } else if (kind === "none" && level < depth) {
        walk(full, level + 1);
      }
    }
  };

  walk(root, 1);
  return found.sort((a, b) => a.name.localeCompare(b.name));
}
