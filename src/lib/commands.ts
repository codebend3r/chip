export type CheCommandName =
  | "sync-all-branches"
  | "update-from-origin"
  | "update-local-branches"
  | "checkout-my-branches"
  | "clean-stale-branches"
  | "prune-worktrees"
  | "all-actions";

/** "repo" runs inside a picked repo; "global" runs from the home directory. */
export type CheScope = "repo" | "global";

export type CheCommand = {
  name: CheCommandName;
  title: string;
  /** Asset filename, also the command icon in package.json. */
  icon: string;
  /** Script path relative to che's bin/. */
  script: string;
  /** Fixed arguments che itself passes for this command. */
  args: readonly string[];
  /** Whether the script honors --dry-run and DRY_RUN. */
  dryRun: boolean;
  scope: CheScope;
};

/**
 * Mirrors the git block of che's commands.py. Two entries reuse another
 * script with a fixed flag, exactly like che does.
 */
export const CHE_COMMANDS: Record<CheCommandName, CheCommand> = {
  "sync-all-branches": {
    name: "sync-all-branches",
    title: "Sync All Branches",
    icon: "sync-all-branches.png",
    script: "git/sync-all-branches.py",
    args: [],
    dryRun: true,
    scope: "repo",
  },
  "update-from-origin": {
    name: "update-from-origin",
    title: "Update from Origin",
    icon: "update-from-origin.png",
    script: "git/sync-all-branches.py",
    args: ["--no-push"],
    dryRun: true,
    scope: "repo",
  },
  "update-local-branches": {
    name: "update-local-branches",
    title: "Update Local Branches",
    icon: "update-local-branches.png",
    script: "git/update-local-branches.py",
    args: [],
    dryRun: true,
    scope: "repo",
  },
  "checkout-my-branches": {
    name: "checkout-my-branches",
    title: "Checkout My Branches",
    icon: "checkout-my-branches.png",
    script: "git/checkout-my-branches.py",
    args: [],
    dryRun: false,
    scope: "repo",
  },
  "clean-stale-branches": {
    name: "clean-stale-branches",
    title: "Clean Stale Branches",
    icon: "clean-stale-branches.png",
    script: "git/clean-stale-branches.py",
    args: [],
    dryRun: true,
    scope: "repo",
  },
  "prune-worktrees": {
    name: "prune-worktrees",
    title: "Prune Worktrees",
    icon: "prune-worktrees.png",
    script: "git/prune-worktrees.py",
    args: [],
    dryRun: true,
    scope: "repo",
  },
  "all-actions": {
    name: "all-actions",
    title: "All Actions",
    icon: "all-actions.png",
    script: "git/all-actions.py",
    args: [],
    dryRun: false,
    scope: "global",
  },
};
