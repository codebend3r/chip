import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getPreferenceValues } from "@raycast/api";

export type CheConfig = {
  /** Root of the che checkout (what the shell calls CHE_HOME). */
  home: string;
  /** Python interpreter that runs the che scripts (CHE_PYTHON). */
  python: string;
  /** Absolute path to bin/git/sync-all-branches.py. */
  script: string;
};

const RC_FILE = join(homedir(), ".zshrc");
const FALLBACK_HOME = join(homedir(), "Developer", "git", "che");
const PYTHON_CANDIDATES = ["/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"];

export function expandHome(path: string): string {
  return path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(1)) : path;
}

/**
 * Read `export NAME=value` from ~/.zshrc. `che install` writes those lines, so
 * following them keeps the extension pointed at whatever the shell uses.
 */
function readRcExport(name: string): string | undefined {
  if (!existsSync(RC_FILE)) return undefined;
  const pattern = new RegExp(`^\\s*export\\s+${name}=(.+?)\\s*$`, "m");
  const match = readFileSync(RC_FILE, "utf8").match(pattern);
  if (!match) return undefined;
  return expandHome(match[1].replace(/^["']|["']$/g, ""));
}

export function resolveChe(): CheConfig {
  const prefs = getPreferenceValues<Preferences>();
  const home = prefs.cheHome?.trim() || readRcExport("CHE_HOME") || FALLBACK_HOME;
  const python =
    prefs.chePython?.trim() || readRcExport("CHE_PYTHON") || PYTHON_CANDIDATES.find((p) => existsSync(p)) || "python3";
  return { home, python, script: join(home, "bin", "git", "sync-all-branches.py") };
}
