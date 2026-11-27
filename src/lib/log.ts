/**
 * che colors every line by meaning (utils.py: log/warning/info/note/success),
 * so with FORCE_COLOR on, the ANSI code at the start of a line tells us what
 * kind of line it is. Anything uncolored came from git or gh, not from che.
 */
export type LogKind = "progress" | "warning" | "info" | "note" | "success" | "plain";

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
};

export type LogStat = {
  label: string;
  value: string;
  kind: LogKind;
  /** Indented lines under the stat, e.g. the branch names behind "Pushed: 2". */
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
/** A summary row once `parseLines` has normalised it: "Up to date: 1". */
const STAT = /^([A-Za-z][\w ()'/-]*?):\s+(\d+)$/;

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
  "90": "plain",
};

function tidy(text: string): string {
  return stripAnsi(text)
    .trim()
    .replace(/\s{2,}/g, " ");
}

export function stripAnsi(text: string): string {
  return text.replace(OSC8, "$2").replace(SGR, "");
}

export function parseLine(raw: string): LogLine {
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

/**
 * One raw line as the lines the views work with. report.py's shapes are
 * normalised first: a summary row becomes "Label: count" plus its first item
 * one level down, so stats and the summary table read every row the same way.
 */
export function parseLines(raw: string): LogLine[] {
  const row = raw.match(ROW);
  if (row) {
    const kind = KIND_BY_TONE[row[1]] ?? "plain";
    const first = tidy(row[5] ?? "");
    return [
      { kind, text: `${tidy(row[3])}: ${row[4]}`, depth: 0 },
      ...(first ? [{ kind, text: first, depth: 1 }] : []),
    ];
  }
  const event = raw.match(EVENT);
  if (event) {
    const kind = KIND_BY_TONE[event[1]] ?? "plain";
    const [item, ...detail] = stripAnsi(event[4])
      .trim()
      .split(/\s{2,}/);
    const tail = detail.length ? ` (${detail.join(", ")})` : "";
    return [{ kind: kind === "plain" ? "info" : kind, text: `${event[2]} ${tidy(event[3])} ${item}${tail}`, depth: 0 }];
  }
  const dim = raw.match(DIM);
  if (dim) return [{ kind: "info", text: tidy(dim[1]), depth: 0 }];
  return [parseLine(raw)];
}

type ParseAccumulator = {
  sections: readonly LogSection[];
  /** The previous line was a `═══` rule, so a note line now is a banner title. */
  afterRule: boolean;
};

function open(acc: ParseAccumulator, section: LogSection): ParseAccumulator {
  return { sections: [...acc.sections, section], afterRule: false };
}

function append(acc: ParseAccumulator, line: LogLine): ParseAccumulator {
  const last = acc.sections.at(-1) ?? { title: "", summary: false, lines: [] };
  const rest = acc.sections.length ? acc.sections.slice(0, -1) : [];
  return { sections: [...rest, { ...last, lines: [...last.lines, line] }], afterRule: false };
}

function collectStats(sections: readonly LogSection[]): LogStat[] {
  return sections
    .filter((section) => section.summary)
    .flatMap((section) =>
      section.lines.reduce<LogStat[]>((stats, line) => {
        const stat = line.depth === 0 ? line.text.match(STAT) : null;
        if (stat) return [...stats, { label: stat[1], value: stat[2], kind: line.kind, items: [] }];
        const last = stats.at(-1);
        if (line.depth > 0 && last) return [...stats.slice(0, -1), { ...last, items: [...last.items, line.text] }];
        return stats;
      }, []),
    );
}

/** Splits raw che output into banner-delimited sections and pulls the summary counts out. */
export function parseRunLog(output: string): RunLog {
  const parsed = output.split("\n").reduce<ParseAccumulator>(
    (acc, raw) => {
      const heading = acc.afterRule ? raw.match(HEADING) : null;
      if (heading) {
        const facts = tidy(heading[2] ?? "");
        const lines: LogLine[] = facts ? [{ kind: "info", text: facts, depth: 0 }] : [];
        return open(acc, { title: tidy(heading[1]), summary: true, lines });
      }
      const [line, ...rest] = parseLines(raw);
      if (line.text === "") return { ...acc, afterRule: false };
      if (RULE.test(line.text)) return { ...acc, afterRule: true };
      if (acc.afterRule && line.kind === "note") return open(acc, { title: line.text, summary: false, lines: [] });
      return [line, ...rest].reduce(append, acc);
    },
    { sections: [], afterRule: false },
  );
  return { sections: parsed.sections, stats: collectStats(parsed.sections) };
}

/** The last thing che complained about, for toasts and empty states. */
export function lastWarning(log: RunLog): string | undefined {
  return log.sections
    .flatMap((section) => section.lines)
    .filter((line) => line.kind === "warning")
    .at(-1)?.text;
}
