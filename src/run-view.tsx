import { homedir } from "node:os";
import { Action, ActionPanel, Color, Detail, Icon, Keyboard, Toast, showToast } from "@raycast/api";
import { useEffect, useMemo } from "react";
import { CheCommand } from "./lib/commands";
import { formatClock, formatDuration } from "./lib/duration";
import { LogKind, RunLog, lastWarning, parseRunLog } from "./lib/log";
import { mdEscape, renderRunLog } from "./lib/render-log";
import { Repo } from "./lib/repos";
import { RunState, useCheRunner } from "./lib/runner";
import { useElapsed } from "./lib/use-elapsed";

type RunViewProps = {
  command: CheCommand;
  /** Absent for global commands, which run from the home directory. */
  repo?: Repo;
  dryRun: boolean;
};

type StatusTag = { text: string; icon: Icon; color: Color };

function statusTag(state: RunState): StatusTag {
  switch (state.status) {
    case "running":
      return { text: "Running", icon: Icon.CircleProgress, color: Color.Blue };
    case "succeeded":
      return { text: "Finished", icon: Icon.CheckCircle, color: Color.Green };
    case "failed":
      return { text: "Failed", icon: Icon.XMarkCircle, color: Color.Red };
  }
}

const STAT_COLOR: Record<LogKind, Color> = {
  progress: Color.Green,
  success: Color.PrimaryText,
  info: Color.PrimaryText,
  note: Color.PrimaryText,
  warning: Color.Red,
  plain: Color.PrimaryText,
};

type LeadProps = {
  command: CheCommand;
  repo: Repo | undefined;
  dryRun: boolean;
  state: RunState;
};

/** The one sentence under the title: what is happening, and whether anything is being changed. */
function lead({ command, repo, dryRun, state }: LeadProps): string {
  const where = repo ? ` in **${mdEscape(repo.name)}**` : "";
  switch (state.status) {
    case "running":
      if (dryRun) return `Previewing what would change${where}. Nothing is modified.`;
      return command.scope === "global" ? "Asking GitHub for your open pull requests." : `Running${where}.`;
    case "succeeded":
      return dryRun ? `Preview finished${where}. Nothing was modified.` : `Finished${where}.`;
    case "failed":
      return state.exitCode === null || state.exitCode === 0
        ? `Could not start${where}.`
        : `Stopped${where} with exit code ${state.exitCode}.`;
  }
}

function body({ command, state, log }: { command: CheCommand; state: RunState; log: RunLog }): string {
  const rendered = renderRunLog(log);
  if (rendered) return rendered;
  if (state.status === "running") return `Waiting for the first line from ${mdEscape(command.script)}.`;
  return "The script printed nothing.";
}

export function RunView({ command, repo, dryRun }: RunViewProps) {
  const cwd = repo?.path ?? homedir();
  const { state, rerun } = useCheRunner({ command, cwd, dryRun });
  const running = state.status === "running";
  const status = statusTag(state);
  const elapsed = useElapsed({ startedAt: state.startedAt, finishedAt: state.finishedAt });
  const log = useMemo(() => parseRunLog(state.output), [state.output]);
  const where = repo ? ` in ${repo.name}` : "";

  useEffect(() => {
    if (state.status === "succeeded") {
      showToast({
        style: Toast.Style.Success,
        title: `${command.title} finished${where}`,
        message: dryRun ? "Preview only, nothing changed" : formatDuration(elapsed),
      });
    } else if (state.status === "failed") {
      showToast({
        style: Toast.Style.Failure,
        title: `${command.title} failed${where}`,
        message:
          state.error ?? lastWarning(log) ?? (state.exitCode !== null ? `Exit code ${state.exitCode}` : undefined),
      });
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- fire once per status change, not when error/exitCode fill in
  }, [state.status]);

  const markdown = [
    `# ${mdEscape(command.title)}`,
    lead({ command, repo, dryRun, state }),
    ...(state.error ? [`> ${mdEscape(state.error)}`] : []),
    body({ command, state, log }),
  ].join("\n\n");

  const scriptLine = [command.script, ...command.args, ...(dryRun ? ["--dry-run"] : [])].join(" ");

  return (
    <Detail
      isLoading={running}
      navigationTitle={dryRun ? `Preview: ${command.title}` : command.title}
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.TagList title="Status">
            <Detail.Metadata.TagList.Item text={status.text} icon={status.icon} color={status.color} />
          </Detail.Metadata.TagList>
          {command.dryRun && (
            <Detail.Metadata.TagList title="Mode">
              {dryRun ? (
                <Detail.Metadata.TagList.Item text="Preview" icon={Icon.Eye} color={Color.Yellow} />
              ) : (
                <Detail.Metadata.TagList.Item text="Live" icon={Icon.Bolt} color={Color.Green} />
              )}
            </Detail.Metadata.TagList>
          )}
          <Detail.Metadata.Label
            title={running ? "Elapsed" : "Took"}
            icon={running ? Icon.Hourglass : Icon.Clock}
            text={formatDuration(elapsed)}
          />
          <Detail.Metadata.Label title="Started" text={formatClock(state.startedAt)} />
          {state.status === "failed" && state.exitCode !== null && (
            <Detail.Metadata.Label title="Exit Code" text={{ value: String(state.exitCode), color: Color.Red }} />
          )}
          {!!log.stats.length && <Detail.Metadata.Separator />}
          {log.stats.map((stat) => (
            <Detail.Metadata.Label
              key={stat.label}
              title={stat.label}
              text={{ value: stat.value, color: stat.value === "0" ? Color.SecondaryText : STAT_COLOR[stat.kind] }}
            />
          ))}
          <Detail.Metadata.Separator />
          {!!repo && <Detail.Metadata.Label title="Repo" icon={Icon.Folder} text={repo.name} />}
          {!!repo?.branch && <Detail.Metadata.Label title="Branch" icon={Icon.Leaf} text={repo.branch} />}
          {!!repo && <Detail.Metadata.Link title="Path" target={`file://${repo.path}`} text={repo.relativePath} />}
          <Detail.Metadata.Label title="Script" icon={Icon.Terminal} text={scriptLine} />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section title={command.title}>
            {!running && dryRun && (
              <Action.Push
                title="Run for Real"
                icon={Icon.Bolt}
                shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
                target={<RunView command={command} repo={repo} dryRun={false} />}
              />
            )}
            {!running && (
              <Action
                title={dryRun ? "Preview Again" : "Run Again"}
                icon={Icon.ArrowClockwise}
                shortcut={Keyboard.Shortcut.Common.Refresh}
                onAction={rerun}
              />
            )}
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action.CopyToClipboard
              title="Copy Output"
              icon={Icon.CodeBlock}
              content={renderRunLog(log)}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
            {!!repo?.remoteUrl && (
              <Action.OpenInBrowser
                title="Open on GitHub"
                icon={Icon.Globe}
                url={repo.remoteUrl}
                shortcut={{ modifiers: ["cmd"], key: "o" }}
              />
            )}
            {!!repo && <Action.ShowInFinder path={repo.path} />}
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
