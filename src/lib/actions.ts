import { stripAnsi } from "./log";

/** One open pull request, or one repo's default branch, and the workflow run all-actions chose to show for it. */
export type ActionRun = {
  repo: string;
  /** The pull request number. Absent on a default-branch row. */
  number?: number;
  /** GitHub's status or conclusion, lowercased: in_progress, success, failure, none, ... */
  status: string;
  workflow: string;
  branch: string;
  age: string;
  took: string;
  /** The workflow run, or the pull request when the head commit has no runs. */
  url: string | undefined;
  /** Still queued or running. */
  live: boolean;
  /** Ended in a state that needs someone to look at it. */
  failed: boolean;
};

const LIVE = new Set(["in_progress", "queued", "waiting", "pending", "requested"]);
const FAILED = new Set(["failure", "timed_out", "startup_failure", "action_required"]);
// oxlint-disable-next-line no-control-regex -- matches the OSC 8 hyperlink on purpose
const OSC8_ONE = /\x1b\]8;;([^\x1b]*)\x1b\\/;

type Table = {
  /** Matches the table's header line once escapes are stripped. */
  header: RegExp;
  /** Whether a `#123` cell follows the repo. The default-branch table has none. */
  pr: boolean;
};

const PR_TABLE: Table = { header: /^REPO\s{2,}PR\s{2,}STATUS/, pr: true };
const BRANCH_TABLE: Table = { header: /^REPO\s{2,}STATUS\s{2,}WORKFLOW/, pr: false };

/** Cells are repo, the PR when the table has one, then status, workflow, branch, age, took. */
function parseRow({ raw, table }: { raw: string; table: Table }): ActionRun | undefined {
  const [repo, ...cells] = stripAnsi(raw)
    .trim()
    .split(/\s{2,}/);
  const fields = table.pr ? cells.slice(1) : cells;
  if (fields.length < 5) return undefined;
  const number = table.pr ? Number(cells[0].replace(/^#/, "")) : undefined;
  if (number !== undefined && !Number.isInteger(number)) return undefined;
  const [statusCell, workflow, branch, age, took] = fields;
  const status = statusCell.split(/\s+/).at(-1) ?? "unknown";
  const url = raw.match(OSC8_ONE)?.[1] || undefined;
  const run = { repo, status, workflow, branch, age, took, url, live: LIVE.has(status), failed: FAILED.has(status) };
  return number === undefined ? run : { ...run, number };
}

/** Rows sit between a table's header and the next blank line. */
function parseTable({ output, table }: { output: string; table: Table }): ActionRun[] {
  const lines = output.split("\n");
  const start = lines.findIndex((line) => table.header.test(stripAnsi(line)));
  if (start === -1) return [];
  const body = lines.slice(start + 1);
  const end = body.findIndex((line) => stripAnsi(line).trim() === "");
  return (end === -1 ? body : body.slice(0, end)).flatMap((raw) => {
    const row = parseRow({ raw, table });
    return row ? [row] : [];
  });
}

/** Reads the pull request table all-actions prints, one row per open PR. */
export function parseActionRuns(output: string): ActionRun[] {
  return parseTable({ output, table: PR_TABLE });
}

/** Reads the default-branch table all-actions prints, one row per repo. */
export function parseBranchRuns(output: string): ActionRun[] {
  return parseTable({ output, table: BRANCH_TABLE });
}

/** The pull request page, derived from the run url when the row links to a run. */
export function pullRequestUrl(run: ActionRun): string | undefined {
  if (!run.url || run.number === undefined) return undefined;
  const [repoUrl] = run.url.split("/actions/");
  return run.url.includes("/actions/") ? `${repoUrl}/pull/${run.number}` : run.url;
}
