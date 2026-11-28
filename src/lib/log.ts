/**
 * che colors every line by meaning (utils.py: log/warning/info/note/success),
 * so with FORCE_COLOR on, the ANSI code at the start of a line tells us what
 * kind of line it is. "dim" is che's own grey text; anything uncolored ("plain")
 * came from git or gh, not from che.
 */
export type LogKind = "progress" | "warning" | "info" | "note" | "success" | "dim" | "plain";

export type LogLine = {
  kind: LogKind;
  /** Text with escapes, indentation, and che's "• " bullet removed. */
  text: string;
  /** 0 for a top-level line, 1+ for che's two-space indented detail lines. */
  depth: number;
  /** Target of an OSC 8 hyperlink, when the line carried one. */
  link?: string;
};

export type LogSection = {
  /** Text of the banner that opened the section; "" before the first banner. */
  title: string;
  /** True for che's closing table: a `─` rule, a bold title, then one row per outcome. */
  summary: boolean;
  lines: readonly LogLine[];
  /** The rows of the closing table. Empty outside a summary. */
  rows: readonly LogStat[];
};

/** One row of a summary table: an outcome and how many items ended up there. */
export type LogStat = {
  label: string;
  value: string;
  kind: LogKind;
  /** The items behind the count, e.g. the branch names behind "Updated  2". */
  items: readonly string[];
};

export type RunLog = {
  sections: readonly LogSection[];
  stats: readonly LogStat[];
};

// oxlint-disable no-control-regex -- these match the escape sequences on purpose
const SGR = /\x1b\[[0-9;]*m/g;
const OSC8 = /\x1b\]8;;([^\x1b]*)\x1b\\([\s\S]*?)\x1b\]8;;\x1b\\/g;
const OSC8_ONE = new RegExp(OSC8.source);
const LEADING_SGR = /^\x1b\[([0-9;]*)m/;
/** report.py's summary heading: a bold title, then dim facts like `2 branches · 0.3s`. */
const HEADING = /^\x1b\[1m(.+?)\x1b\[0m(?: {2}\x1b\[90m(.*?)\x1b\[0m)?\s*$/;
/** A summary row: `  = Up to date  1   main`. Colored symbol, label, bold count, optional first item. */
const ROW = /^ {2}\x1b\[(\d+)m(\S+)\x1b\[0m (.+?) {2}\x1b\[1m\s*(\d+)\x1b\[0m(?: {3}(.*))?$/;
/** A live event: `  ✓ updated       feature-x  3 new commits`. The color wraps the symbol and the padded verb. */
const EVENT = /^ {2}\x1b\[(\d+)m(\S+) (.*?)\s*\x1b\[0m {2}(.*)$/;
/** A dim line under the summary table. */
const DIM = /^ {2}\x1b\[90m(.*)\x1b\[0m\s*$/;
// oxlint-enable no-control-regex
const RULE = /^[═─]{3,}$/;

const KIND_BY_CODE: Record<string, LogKind> = {
  "0;32": "progress",
  "1;31": "warning",
  "1;36": "info",
  "1;33": "note",
  "1;35": "success",
};

/** report.py's tones: green done, cyan planned or noted, yellow needs attention, red failed, grey unchanged. */
const KIND_BY_TONE: Record<string, LogKind> = {
  "32": "progress",
  "36": "info",
  "33": "note",
  "31": "warning",
  "90": "dim",
};

function toneKind(code: string): LogKind {
  return KIND_BY_TONE[code] ?? "plain";
}

function tidy(text: string): string {
  return stripAnsi(text)
    .trim()
    .replace(/\s{2,}/g, " ");
}

export function stripAnsi(text: string): string {
  return text.replace(OSC8, "$2").replace(SGR, "");
}

/** report.py's event and dim lines first, else the line as utils.py, git or gh printed it. */
export function parseLine(raw: string): LogLine {
  const event = raw.match(EVENT);
  if (event) {
    const [item, ...detail] = stripAnsi(event[4])
      .trim()
      .split(/\s{2,}/);
    const tail = detail.length ? ` (${detail.join(", ")})` : "";
    return { kind: toneKind(event[1]), text: `${event[2]} ${tidy(event[3])} ${item}${tail}`, depth: 0 };
  }
  const dim = raw.match(DIM);
  if (dim) return { kind: "dim", text: tidy(dim[1]), depth: 0 };

  const code = raw.match(LEADING_SGR)?.[1];
  const kind = (code !== undefined && KIND_BY_CODE[code]) || "plain";
  const link = raw.match(OSC8_ONE)?.[1] || undefined;
  const text = stripAnsi(raw).replace(/\s+$/, "");
  const leading = text.length - text.trimStart().length;
  const body = text
    .trim()
    .replace(/^•\s+/, "")
    .replace(/\s{2,}/g, " ");
  return { kind, text: body, depth: Math.min(3, Math.floor(leading / 2)), ...(link ? { link } : {}) };
}

/** A summary row, with the item report.py prints beside the count. */
function parseRow(raw: string): LogStat | undefined {
  const row = raw.match(ROW);
  if (!row) return undefined;
  const first = tidy(row[5] ?? "");
  return { label: tidy(row[3]), value: row[4], kind: toneKind(row[1]), items: first ? [first] : [] };
}

type ParseAccumulator = {
  sections: readonly LogSection[];
  /** The previous line was a `═══` rule, so a note line now is a banner title. */
  afterRule: boolean;
};

const UNTITLED: LogSection = { title: "", summary: false, lines: [], rows: [] };

function open(acc: ParseAccumulator, section: Pick<LogSection, "title" | "summary" | "lines">): ParseAccumulator {
  return { sections: [...acc.sections, { ...section, rows: [] }], afterRule: false };
}

/** Replaces the section being written, starting an untitled one when che printed before any banner. */
function amend(acc: ParseAccumulator, change: (section: LogSection) => LogSection): ParseAccumulator {
  return { sections: [...acc.sections.slice(0, -1), change(acc.sections.at(-1) ?? UNTITLED)], afterRule: false };
}

function addItem(rows: readonly LogStat[], item: string): LogStat[] {
  return rows.map((row, i) => (i === rows.length - 1 ? { ...row, items: [...row.items, item] } : row));
}

function step(acc: ParseAccumulator, raw: string): ParseAccumulator {
  const heading = acc.afterRule ? raw.match(HEADING) : null;
  if (heading) {
    const facts = tidy(heading[2] ?? "");
    const lines: LogLine[] = facts ? [{ kind: "dim", text: facts, depth: 0 }] : [];
    return open(acc, { title: tidy(heading[1]), summary: true, lines });
  }

  const current = acc.sections.at(-1) ?? UNTITLED;
  const row = current.summary ? parseRow(raw) : undefined;
  if (row) return amend(acc, (section) => ({ ...section, rows: [...section.rows, row] }));

  const line = parseLine(raw);
  if (line.text === "") return { ...acc, afterRule: false };
  if (RULE.test(line.text)) return { ...acc, afterRule: true };
  if (acc.afterRule && line.kind === "note") return open(acc, { title: line.text, summary: false, lines: [] });
  // report.py lists a row's remaining items on their own lines, indented under the first.
  if (line.depth > 0 && current.rows.length) {
    return amend(acc, (section) => ({ ...section, rows: addItem(section.rows, line.text) }));
  }
  return amend(acc, (section) => ({ ...section, lines: [...section.lines, line] }));
}

/** Splits raw che output into banner-delimited sections; the summary's rows double as the run's stats. */
export function parseRunLog(output: string): RunLog {
  const { sections } = output.split("\n").reduce<ParseAccumulator>(step, { sections: [], afterRule: false });
  return { sections, stats: sections.flatMap((section) => section.rows) };
}

/** The last thing che complained about, for toasts and empty states. */
export function lastWarning(log: RunLog): string | undefined {
  return log.sections
    .flatMap((section) => section.lines)
    .filter((line) => line.kind === "warning")
    .at(-1)?.text;
}
