import { LogLine, LogSection, RunLog } from "./log";

/** Branch names like `feat_x_y` would otherwise italicize; escape everything markdown could misread. */
export function mdEscape(text: string): string {
  return text.replace(/([\\`*_[\]<>#|~])/g, "\\$1");
}

type Block = { kind: "text" | "list" | "code"; lines: readonly LogLine[] };

function blockKind(line: LogLine): Block["kind"] {
  if (line.kind === "plain") return "code";
  return line.depth > 0 ? "list" : "text";
}

/** Consecutive lines of the same shape share one markdown block. */
function groupBlocks(lines: readonly LogLine[]): Block[] {
  return lines.reduce<Block[]>((blocks, line) => {
    const kind = blockKind(line);
    const last = blocks.at(-1);
    if (last && last.kind === kind) return [...blocks.slice(0, -1), { kind, lines: [...last.lines, line] }];
    return [...blocks, { kind, lines: [line] }];
  }, []);
}

function inline(line: LogLine): string {
  const text = line.link ? `[${mdEscape(line.text)}](${line.link})` : mdEscape(line.text);
  return line.kind === "warning" ? `**${text}**` : text;
}

function renderBlock(block: Block): string {
  switch (block.kind) {
    case "text":
      return block.lines.map((line) => `${inline(line)}  `).join("\n");
    case "list":
      return block.lines.map((line) => `${"  ".repeat(line.depth - 1)}- ${inline(line)}`).join("\n");
    case "code":
      return ["```", ...block.lines.map((line) => `${"  ".repeat(line.depth)}${line.text}`), "```"].join("\n");
  }
}

/** A summary block becomes a table when it holds counts; the rest of its lines follow as text. */
function renderSummary(section: LogSection): string {
  const isStat = (line: LogLine) => line.depth === 0 && /:\s+\d+$/.test(line.text);
  const rows = section.lines.reduce<{ label: string; count: string; items: string[] }[]>((acc, line) => {
    const stat = isStat(line) ? line.text.match(/^(.*?):\s+(\d+)$/) : null;
    if (stat) return [...acc, { label: stat[1], count: stat[2], items: [] }];
    const last = acc.at(-1);
    if (line.depth > 0 && last) return [...acc.slice(0, -1), { ...last, items: [...last.items, line.text] }];
    return acc;
  }, []);
  const rest = section.lines.filter((line) => !isStat(line) && line.depth === 0);
  const table = rows.length
    ? [
        `| ${mdEscape(section.title)} | | |`,
        "| :-- | --: | :-- |",
        ...rows.map((row) => `| ${mdEscape(row.label)} | ${row.count} | ${row.items.map(mdEscape).join(", ")} |`),
      ].join("\n")
    : `### ${mdEscape(section.title)}`;
  return [table, ...groupBlocks(rest).map(renderBlock)].join("\n\n");
}

function renderSection(section: LogSection): string {
  if (section.summary) return renderSummary(section);
  const heading = section.title ? [`## ${mdEscape(section.title)}`] : [];
  return [...heading, ...groupBlocks(section.lines).map(renderBlock)].join("\n\n");
}

export function renderRunLog(log: RunLog): string {
  return log.sections.map(renderSection).join("\n\n");
}
