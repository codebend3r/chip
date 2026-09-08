import { existsSync } from "node:fs";
import { join } from "node:path";
import { environment, getPreferenceValues } from "@raycast/api";

export type CheConfig = {
  /** Python interpreter that runs the che scripts. */
  python: string;
  /** Absolute path to the requested script inside the bundled che assets. */
  script: string;
};

export type ResolveCheOptions = {
  /** Script path relative to che's bin/, e.g. `git/sync-all-branches.py`. */
  script: string;
};

/**
 * `postinstall` copies `@codebend3r/che`'s bin/ into assets/che/bin so Raycast
 * ships the scripts with every build. Nothing outside the repo is consulted.
 */
const CHE_BIN = join(environment.assetsPath, "che", "bin");
const PYTHON_CANDIDATES = ["/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"];

export function resolveChe({ script }: ResolveCheOptions): CheConfig {
  const prefs = getPreferenceValues<Preferences>();
  const preferred = prefs.chePython?.trim() ?? "";
  const python = preferred || PYTHON_CANDIDATES.find((p) => existsSync(p)) || "python3";
  return { python, script: join(CHE_BIN, script) };
}
