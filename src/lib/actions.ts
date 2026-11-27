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
};

const LIVE = new Set(["in_progress", "queued", "waiting", "pending", "requested"]);
// oxlint-disable-next-line no-control-regex -- matches the OSC 8 hyperlink on purpose
const OSC8_ONE = /\x1b\]8;;([^\x1b]*)\x1b\\/;

function parseRow(raw: string): ActionRun | undefined {
  const cells = stripAnsi(raw)
    .trim()
    .split(/\s{2,}/);
  if (cells.length < 7) return undefined;
  const [repo, pr, statusCell, workflow, branch, age, took] = cells;
  const number = Number(pr.replace(/^#/, ""));
  if (!Number.isInteger(number)) return undefined;
  const status = statusCell.split(/\s+/).at(-1) ?? "unknown";
  const url = raw.match(OSC8_ONE)?.[1] || undefined;
  return { repo, number, status, workflow, branch, age, took, url, live: LIVE.has(status) };
}

/** A default-branch row has no PR cell: repo, status, workflow, branch, age, took. */
function parseBranchRow(raw: string): ActionRun | undefined {
  const cells = stripAnsi(raw)
    .trim()
    .split(/\s{2,}/);
  if (cells.length < 5) return undefined;
  const [repo, statusCell, workflow, branch, age, took = "-"] = cells;
  const status = statusCell.split(/\s+/).at(-1) ?? "unknown";
  const url = raw.match(OSC8_ONE)?.[1] || undefined;
  return { repo, status, workflow, branch, age, took, url, live: LIVE.has(status) };
}

type TableOptions = {
  output: string;
  /** Matches the table's header line once escapes are stripped. */
  header: RegExp;
  parse: (raw: string) => ActionRun | undefined;
};

/** Rows sit between a table's header and the next blank line. */
function parseTable({ output, header, parse }: TableOptions): ActionRun[] {
  const lines = output.split("\n");
  const start = lines.findIndex((line) => header.test(stripAnsi(line)));
  if (start === -1) return [];
  const body = lines.slice(start + 1);
  const end = body.findIndex((line) => stripAnsi(line).trim() === "");
  return (end === -1 ? body : body.slice(0, end)).flatMap((line) => {
    const row = parse(line);
    return row ? [row] : [];
  });
}

/** Reads the pull request table all-actions prints, one row per open PR. */
export function parseActionRuns(output: string): ActionRun[] {
  return parseTable({ output, header: /^REPO\s{2,}PR\s{2,}STATUS/, parse: parseRow });
}

/** Reads the default-branch table all-actions prints, one row per repo. */
export function parseBranchRuns(output: string): ActionRun[] {
  return parseTable({ output, header: /^REPO\s{2,}STATUS\s{2,}WORKFLOW/, parse: parseBranchRow });
}

/** The pull request page, derived from the run url when the row links to a run. */
export function pullRequestUrl(run: ActionRun): string | undefined {
  if (!run.url || run.number === undefined) return undefined;
  const [repoUrl] = run.url.split("/actions/");
  return run.url.includes("/actions/") ? `${repoUrl}/pull/${run.number}` : run.url;
}
