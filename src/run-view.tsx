import { Action, ActionPanel, Color, Detail, Icon, Toast, showToast } from "@raycast/api";
import { useEffect } from "react";
import { Repo } from "./lib/repos";
import { RunState, useSyncRunner } from "./lib/runner";

type RunViewProps = {
  repo: Repo;
  dryRun: boolean;
};

function statusLabel(state: RunState): { text: string; icon: Icon; color: Color } {
  switch (state.status) {
    case "running":
      return { text: "Running", icon: Icon.CircleProgress, color: Color.Blue };
    case "succeeded":
      return { text: "Succeeded", icon: Icon.CheckCircle, color: Color.Green };
    case "failed":
      return { text: "Failed", icon: Icon.XMarkCircle, color: Color.Red };
  }
}

function duration(state: RunState): string | undefined {
  if (state.finishedAt === null) return undefined;
  return `${((state.finishedAt - state.startedAt) / 1000).toFixed(1)}s`;
}

export function RunView({ repo, dryRun }: RunViewProps) {
  const { state, rerun } = useSyncRunner({ cwd: repo.path, dryRun });
  const running = state.status === "running";
  const status = statusLabel(state);
  const mode = dryRun ? "Dry run" : "Live";
  const durationText = duration(state);

  useEffect(() => {
    if (state.status === "succeeded") {
      showToast({ style: Toast.Style.Success, title: `${repo.name} synced`, message: mode });
    } else if (state.status === "failed") {
      showToast({
        style: Toast.Style.Failure,
        title: `${repo.name} sync failed`,
        message: state.error ?? (state.exitCode !== null ? `exit code ${state.exitCode}` : undefined),
      });
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- fire once per status change, not when error/exitCode fill in
  }, [state.status]);

  const body = state.output || (running ? "Starting sync-all-branches..." : "(no output)");
  const markdown = [
    `# ${dryRun ? "Preview" : "Sync"}: ${repo.name}`,
    "",
    "```",
    body,
    "```",
    state.error ? `\n> ${state.error}` : "",
  ].join("\n");

  return (
    <Detail
      isLoading={running}
      navigationTitle={`${repo.name}${dryRun ? " (dry run)" : ""}`}
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Repo" text={repo.path} />
          <Detail.Metadata.TagList title="Mode">
            <Detail.Metadata.TagList.Item text={mode} color={dryRun ? Color.Yellow : Color.Green} />
          </Detail.Metadata.TagList>
          <Detail.Metadata.TagList title="Status">
            <Detail.Metadata.TagList.Item text={status.text} icon={status.icon} color={status.color} />
          </Detail.Metadata.TagList>
          {state.exitCode !== null && <Detail.Metadata.Label title="Exit Code" text={String(state.exitCode)} />}
          {!!durationText && <Detail.Metadata.Label title="Duration" text={durationText} />}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section title={repo.name}>
            {!running && <Action title="Run Again" icon={Icon.ArrowClockwise} onAction={rerun} />}
            {!running && dryRun && (
              <Action.Push
                title="Run for Real"
                icon={Icon.Rocket}
                shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
                target={<RunView repo={repo} dryRun={false} />}
              />
            )}
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action.CopyToClipboard
              title="Copy Output"
              content={state.output}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
            <Action.ShowInFinder path={repo.path} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
