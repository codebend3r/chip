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
  /** One sentence, in the script's own words, on what a run does. */
  summary: string;
  /** What the script does, mirroring its docstring. */
  steps: readonly string[];
  /** The steps run strictly in this order, so the briefing numbers them. */
  ordered: boolean;
  /** What a live run can delete. Absent when nothing is removed. */
  removes?: string;
  /** What the script refuses to run without. */
  needs?: string;
};

const SYNC_STEPS = [
  "Fetch and prune every remote",
  "Push each linked worktree's branch to origin",
  "Remove worktrees that are clean and fully pushed, keeping their branches",
  "Prune stale worktree records",
  "Switch the main clone to the main branch",
  "Delete local branches whose upstream is gone",
  "Rebase every local branch onto its upstream",
  "Check out your remote branches that are not local yet",
] as const;

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
    summary: "Push every worktree, collapse the pushed ones, then tidy branches.",
    steps: SYNC_STEPS,
    ordered: true,
    removes: "Worktrees that are clean and pushed, and local branches whose upstream is gone.",
    needs: "No uncommitted tracked changes in the main clone.",
  },
  "update-from-origin": {
    name: "update-from-origin",
    title: "Update from Origin",
    icon: "update-from-origin.png",
    script: "git/sync-all-branches.py",
    args: ["--no-push"],
    dryRun: true,
    scope: "repo",
    summary: "Sync without pushing: collapse worktrees already on origin, then tidy branches.",
    steps: SYNC_STEPS.filter((step) => !step.startsWith("Push")),
    ordered: true,
    removes: "Worktrees that are clean and already pushed, and local branches whose upstream is gone.",
    needs: "No uncommitted tracked changes in the main clone.",
  },
  "update-local-branches": {
    name: "update-local-branches",
    title: "Update Local Branches",
    icon: "update-local-branches.png",
    script: "git/update-local-branches.py",
    args: [],
    dryRun: true,
    scope: "repo",
    summary: "Rebase every local branch that has an upstream onto origin.",
    steps: [
      "Fetch remotes",
      "Rebase each branch, inside its worktree when it has one",
      "Abort and report any rebase that hits a conflict",
      "Return to the branch you started on",
    ],
    ordered: true,
    needs: "A clean working tree on a checked-out branch.",
  },
  "checkout-my-branches": {
    name: "checkout-my-branches",
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
      "Create a tracking branch for each of yours that is missing locally",
    ],
    ordered: true,
    needs: "A clean working tree.",
  },
  "clean-stale-branches": {
    name: "clean-stale-branches",
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
      "Skip the checked-out branch and any branch pinned in a worktree",
      "Delete the rest",
    ],
    ordered: true,
    removes: "Local branches whose upstream is gone.",
  },
  "prune-worktrees": {
    name: "prune-worktrees",
    title: "Prune Worktrees",
    icon: "prune-worktrees.png",
    script: "git/prune-worktrees.py",
    args: [],
    dryRun: true,
    scope: "repo",
    summary: "Remove every linked worktree, then prune stale worktree records.",
    steps: [
      "Switch the main clone to the main branch",
      "Remove each linked worktree; git refuses ones with uncommitted changes",
      "Prune stale worktree records",
    ],
    ordered: true,
    removes: "Every linked worktree. Branches stay.",
    needs: "No uncommitted tracked changes in the main clone.",
  },
  "all-actions": {
    name: "all-actions",
    title: "All Actions",
    icon: "all-actions.png",
    script: "git/all-actions.py",
    args: [],
    dryRun: false,
    scope: "global",
    summary: "The latest GitHub Actions run for every open pull request you authored.",
    steps: [
      "Ask GitHub for every open pull request you authored in repos you own",
      "For each, pick the run worth acting on: in flight, else failed, else newest",
    ],
    ordered: false,
  },
};
