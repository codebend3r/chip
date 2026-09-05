import { ChildProcess, spawn } from "node:child_process";
import { join } from "node:path";
import { useCallback, useEffect, useRef, useState } from "react";
import { resolveChe } from "./che";

export type RunStatus = "running" | "succeeded" | "failed";

export interface RunState {
  status: RunStatus;
  output: string;
  exitCode: number | null;
  startedAt: number;
  finishedAt: number | null;
  error?: string;
}

export interface RunOptions {
  cwd: string;
  dryRun: boolean;
}

/** Raycast launches node with a bare PATH; git and python live here on macOS. */
const EXTRA_PATH = [
  "/opt/homebrew/bin",
  "/opt/homebrew/sbin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
];

function freshState(): RunState {
  return { status: "running", output: "", exitCode: null, startedAt: Date.now(), finishedAt: null };
}

/**
 * Runs che's sync-all-branches.py in `cwd`, streaming stdout and stderr into
 * state as they arrive. Starts on mount and whenever cwd or dryRun change.
 */
export function useSyncRunner({ cwd, dryRun }: RunOptions) {
  const [state, setState] = useState<RunState>(freshState);
  const child = useRef<ChildProcess | null>(null);

  const run = useCallback(() => {
    child.current?.kill();
    setState(freshState());

    const che = resolveChe();
    const args = [che.script, ...(dryRun ? ["--dry-run"] : [])];
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: [...EXTRA_PATH, process.env.PATH ?? ""].filter(Boolean).join(":"),
      CHE_HOME: che.home,
      CHE_BIN: join(che.home, "bin"),
      CHE_PYTHON: che.python,
      DRY_RUN: dryRun ? "true" : "false",
      NO_COLOR: "1",
      PYTHONUNBUFFERED: "1",
      GIT_TERMINAL_PROMPT: "0",
    };

    const proc = spawn(che.python, args, { cwd, env });
    child.current = proc;

    const append = (chunk: Buffer) => setState((s) => ({ ...s, output: s.output + chunk.toString("utf8") }));
    proc.stdout.on("data", append);
    proc.stderr.on("data", append);
    proc.on("error", (err) =>
      setState((s) => ({ ...s, status: "failed", error: `${err.message} (${che.python})`, finishedAt: Date.now() })),
    );
    proc.on("close", (code) =>
      setState((s) => ({
        ...s,
        status: code === 0 && !s.error ? "succeeded" : "failed",
        exitCode: code,
        finishedAt: s.finishedAt ?? Date.now(),
      })),
    );
  }, [cwd, dryRun]);

  useEffect(() => {
    run();
    return () => {
      child.current?.kill();
    };
  }, [run]);

  return { state, rerun: run };
}
