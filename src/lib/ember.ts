import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Color, environment } from "@raycast/api";
import { CheCommand } from "./commands";

type EmberTone = "accent" | "good" | "warn" | "info" | "danger" | "muted";

/**
 * The Ember palette. Dark values are the design's own; light values are the
 * same hues darkened so they stay readable on a light Raycast theme.
 */
export const EMBER: Record<EmberTone, Color.Dynamic> = {
  accent: { light: "#b45309", dark: "#f59e0b" },
  good: { light: "#1f7a3d", dark: "#8adba3" },
  warn: { light: "#a35a00", dark: "#fcc062" },
  info: { light: "#3f51b5", dark: "#b3c0f3" },
  danger: { light: "#b42318", dark: "#f2867a" },
  muted: { light: "#6b6258", dark: "#b5aa9f" },
};

export type Pill = { text: string; color: Color.ColorLike };

type EmberHeadOptions = {
  command: CheCommand;
  /** The small line above the title. */
  eyebrow: string;
  title: string;
  /** Already-escaped markdown shown under the title. */
  lead: string;
};

/** The amber icon tile, an eyebrow, the title, then one line of description. */
export function emberHead({ command, eyebrow, title, lead }: EmberHeadOptions): string {
  const tile = pathToFileURL(join(environment.assetsPath, "ember", command.icon)).href;
  return [`![](${tile}?raycast-width=48&raycast-height=48)`, `\`${eyebrow.toUpperCase()}\``, `# ${title}`, lead].join(
    "\n\n",
  );
}
