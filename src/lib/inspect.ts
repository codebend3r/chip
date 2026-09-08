import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { spawnPath } from "./path";

const exec = promisify(execFile);

export type RepoInspection = {
  /** Checked-out branch, or undefined when detached. */
  branch: string | undefined;
  upstream: string | undefined;
  ahead: number;
  behind: number;
  /** Modified, staged, or untracked paths. */
  changes: number;
  /** Linked worktrees, not counting the main clone. */
  worktrees: number;
  /** Local branches, and how many of them have an upstream that is gone. */
  branches: number;
  stale: number;
  lastCommit: { sha: string; subject: string; when: string } | undefined;
};

type InspectRepoOptions = {
  path: string;
};

/** Read-only git queries. A failing one answers "" so a detached head or missing upstream never throws. */
async function git({ path, args }: { path: string; args: readonly string[] }): Promise<string> {
  try {
    const { stdout } = await exec("git", [...args], {
      cwd: path,
      env: { ...process.env, PATH: spawnPath(), GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" },
    });
    return stdout.trim();
  } catch {
    return "";
  }
}

/** Everything the briefing panel shows about a repo, in six read-only git calls run together. */
export async function inspectRepo({ path }: InspectRepoOptions): Promise<RepoInspection> {
  const [branch, upstream, counts, status, worktrees, refs, last] = await Promise.all([
    git({ path, args: ["symbolic-ref", "--quiet", "--short", "HEAD"] }),
    git({ path, args: ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"] }),
    git({ path, args: ["rev-list", "--left-right", "--count", "@{u}...HEAD"] }),
    git({ path, args: ["status", "--porcelain"] }),
    git({ path, args: ["worktree", "list", "--porcelain"] }),
    git({ path, args: ["for-each-ref", "--format=%(upstream:track)", "refs/heads"] }),
    git({ path, args: ["log", "-1", "--format=%h%x01%s%x01%cr"] }),
  ]);

  const [behind = 0, ahead = 0] = counts.split(/\s+/).map(Number);
  const refLines = refs ? refs.split("\n") : [];
  const [sha, subject, when] = last.split("\x01");

  return {
    branch: branch || undefined,
    upstream: upstream || undefined,
    ahead: Number.isFinite(ahead) ? ahead : 0,
    behind: Number.isFinite(behind) ? behind : 0,
    changes: status ? status.split("\n").length : 0,
    worktrees: Math.max(0, (worktrees.match(/^worktree /gm)?.length ?? 1) - 1),
    branches: refLines.length,
    stale: refLines.filter((line) => line.includes("[gone]")).length,
    lastCommit: sha && subject ? { sha, subject, when: when ?? "" } : undefined,
  };
}
