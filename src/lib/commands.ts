export type CheCommandName =
  | "sync-all-branches"
  | "update-from-origin"
  | "update-local-branches"
  | "checkout-my-branches"
  | "clean-stale-branches"
  | "prune-worktrees"
  | "all-actions";

export type CheGroupKey = "branches" | "worktrees" | "github";

export type CheGroup = {
  key: CheGroupKey;
  title: string;
  /** Shown beside the section title. */
  blurb: string;
};

/** Keyed for lookup by `CheCommand.group`; the menu lists the sections in this order. */
export const CHE_GROUPS: Record<CheGroupKey, CheGroup> = {
  branches: { key: "branches", title: "Branches", blurb: "Sync, rebase, check out and clean" },
  worktrees: { key: "worktrees", title: "Worktrees", blurb: "Linked worktrees and their records" },
  github: { key: "github", title: "GitHub", blurb: "Actions runs for pull requests and default branches" },
};

/** "repo" runs inside a picked repo; "global" runs from the home directory. */
export type CheScope = "repo" | "global";

export type CheCommand = {
  name: CheCommandName;
  title: string;
  /** The menu section this command is listed under. */
  group: CheGroupKey;
  /** Asset filename, also the command icon in package.json. */
  icon: string;
  /** Script path relative to che's bin/. */
  script: string;
  /** Fixed arguments che itself passes for this command. */
  args: readonly string[];
  /** Whether the script honors --dry-run and DRY_RUN. */
  dryRun: boolean;
  scope: CheScope;
  /** One sentence, in the script's own words, on what a run does. */
  summary: string;
  /** What the script does, mirroring its docstring. */
  steps: readonly string[];
  /** The steps run strictly in this order, so the briefing numbers them. */
  ordered: boolean;
  /** What a live run can delete. Absent when nothing is removed. */
  removes?: string;
};

/** Everything `sync-all-branches` and its alias share: che runs the same script for both. */
const SYNC = {
  group: "branches",
  script: "git/sync-all-branches.py",
  dryRun: true,
  scope: "repo",
  steps: [
    "Fetch every remote once",
    "Delete branches already merged into a main or dev branch, along with their worktrees",
    "Rebase every other branch onto its upstream, inside its worktree when it has one",
    "Stash uncommitted work before a rebase and restore it afterwards",
    "Track origin feature branches that are not local yet and not merged",
    "Report conflicts and carry on with the remaining branches",
  ],
  ordered: true,
  removes:
    "Branches merged into a main or dev branch, and their worktrees. Uncommitted work in a merged worktree stays stashed. Nothing is pushed.",
} satisfies Partial<CheCommand>;

/**
 * Mirrors the git block of che's commands.py. Two entries reuse another
 * script with a fixed flag, exactly like che does.
 */
export const CHE_COMMANDS: Record<CheCommandName, CheCommand> = {
  "sync-all-branches": {
    ...SYNC,
    name: "sync-all-branches",
    title: "Sync All Branches",
    icon: "sync-all-branches.png",
    args: [],
    summary: "Update every branch and worktree, pruning what has been merged.",
  },
  "update-from-origin": {
    ...SYNC,
    name: "update-from-origin",
    title: "Update from Origin",
    icon: "update-from-origin.png",
    args: ["--dry-run=false"],
    summary: "Alias of Sync All Branches: update every branch and worktree, pruning what has been merged.",
  },
  "update-local-branches": {
    name: "update-local-branches",
    group: "branches",
    title: "Update Local Branches",
    icon: "update-local-branches.png",
    script: "git/update-local-branches.py",
    args: [],
    dryRun: true,
    scope: "repo",
    summary: "Rebase every local branch that has an upstream onto origin.",
    steps: [
      "Fetch and prune every remote",
      "Rebase each branch that has an upstream onto origin",
      "Abort and report any rebase that hits a conflict, then keep going",
    ],
    ordered: true,
  },
  "checkout-my-branches": {
    name: "checkout-my-branches",
    group: "branches",
    title: "Checkout My Branches",
    icon: "checkout-my-branches.png",
    script: "git/checkout-my-branches.py",
    args: [],
    dryRun: false,
    scope: "repo",
    summary: "Check out recent remote branches you authored that are not local yet.",
    steps: [
      "Fetch remotes",
      "Scan the most recent remote branches for your git author email",
      "Create a tracking branch for each of yours that is missing locally; HEAD stays where it is",
    ],
    ordered: true,
  },
  "clean-stale-branches": {
    name: "clean-stale-branches",
    group: "branches",
    title: "Clean Stale Branches",
    icon: "clean-stale-branches.png",
    script: "git/clean-stale-branches.py",
    args: [],
    dryRun: true,
    scope: "repo",
    summary: "Delete local branches whose upstream is gone.",
    steps: [
      "Fetch and prune every remote",
      "Find local branches whose upstream no longer exists",
      "Skip protected branches (main, master, dev, develop, staging) and any branch checked out in a worktree",
      "Delete the rest",
    ],
    ordered: true,
    removes: "Local branches whose upstream is gone.",
  },
  "prune-worktrees": {
    name: "prune-worktrees",
    group: "worktrees",
    title: "Prune Worktrees",
    icon: "prune-worktrees.png",
    script: "git/prune-worktrees.py",
    args: [],
    dryRun: true,
    scope: "repo",
    summary: "Remove every linked worktree, then prune stale worktree records.",
    steps: [
      "Leave the main worktree untouched",
      "For each linked worktree, drop its lock and abort any rebase, merge, cherry-pick, revert or bisect in progress",
      "Stash its uncommitted tracked and untracked work so `git stash list` still has it",
      "Remove the worktree; one failure never stops the rest",
      "Prune stale worktree records",
    ],
    ordered: true,
    removes: "Every linked worktree, locked, dirty or mid-rebase included. Uncommitted work is stashed first.",
  },
  "all-actions": {
    name: "all-actions",
    group: "github",
    title: "All Actions",
    icon: "all-actions.png",
    script: "git/all-actions.py",
    args: [],
    dryRun: false,
    scope: "global",
    summary: "The latest GitHub Actions run for every open pull request you authored and every default branch.",
    steps: [
      "Ask GitHub for every open pull request you authored in repos you own",
      "For each, pick the run worth acting on: in flight, else failed, else newest",
      "Then show the run on the default branch of every repo you own",
    ],
    ordered: false,
  },
};
