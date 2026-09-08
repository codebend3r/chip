import { homedir } from "node:os";
import { Action, ActionPanel, Color, Detail, Icon, Keyboard, List, Toast, showToast } from "@raycast/api";
import { useEffect, useMemo } from "react";
import { ActionRun, parseActionRuns, pullRequestUrl } from "./lib/actions";
import { CHE_COMMANDS } from "./lib/commands";
import { formatClock } from "./lib/duration";
import { lastWarning, parseRunLog, stripAnsi } from "./lib/log";
import { useCheRunner } from "./lib/runner";

const command = CHE_COMMANDS["all-actions"];

type StatusLook = { icon: Icon; color: Color; label: string };

/** Mirrors STATUS_ICONS in all-actions.py, with Raycast's own icons and one color per outcome. */
function statusLook(status: string): StatusLook {
  switch (status) {
    case "in_progress":
      return { icon: Icon.CircleProgress, color: Color.Blue, label: "Running" };
    case "queued":
    case "waiting":
    case "pending":
    case "requested":
      return { icon: Icon.Clock, color: Color.Yellow, label: "Queued" };
    case "success":
      return { icon: Icon.CheckCircle, color: Color.Green, label: "Passed" };
    case "failure":
    case "timed_out":
    case "startup_failure":
    case "action_required":
      return { icon: Icon.XMarkCircle, color: Color.Red, label: status.replace(/_/g, " ") };
    case "cancelled":
      return { icon: Icon.Stop, color: Color.SecondaryText, label: "Cancelled" };
    case "skipped":
      return { icon: Icon.Forward, color: Color.SecondaryText, label: "Skipped" };
    case "none":
      return { icon: Icon.Minus, color: Color.SecondaryText, label: "No runs" };
    default:
      return { icon: Icon.QuestionMark, color: Color.SecondaryText, label: status };
  }
}

type RawOutputProps = {
  output: string;
};

function RawOutput({ output }: RawOutputProps) {
  return <Detail navigationTitle="All Actions Output" markdown={["```", stripAnsi(output).trim(), "```"].join("\n")} />;
}

type RunItemProps = {
  run: ActionRun;
  rerun: () => void;
  output: string;
};

function RunItem({ run, rerun, output }: RunItemProps) {
  const look = statusLook(run.status);
  const prUrl = pullRequestUrl(run);
  const runUrl = run.url && run.url !== prUrl ? run.url : undefined;

  return (
    <List.Item
      icon={{ source: look.icon, tintColor: look.color }}
      title={run.repo}
      subtitle={run.branch}
      keywords={[run.workflow, run.status, `#${run.number}`]}
      accessories={[
        { text: run.workflow, tooltip: "Workflow" },
        { tag: { value: look.label, color: look.color } },
        ...(run.took !== "-" ? [{ text: run.took, icon: Icon.Clock, tooltip: "Run duration" }] : []),
        { text: `#${run.number}`, tooltip: `Opened ${run.age} ago` },
      ]}
      actions={
        <ActionPanel>
          <ActionPanel.Section title={`${run.repo} #${run.number}`}>
            {!!runUrl && <Action.OpenInBrowser title="Open Workflow Run" icon={Icon.Play} url={runUrl} />}
            {!!prUrl && (
              <Action.OpenInBrowser
                title="Open Pull Request"
                icon={Icon.Globe}
                url={prUrl}
                shortcut={{ modifiers: ["cmd"], key: "o" }}
              />
            )}
            <Action.CopyToClipboard
              title="Copy Branch Name"
              content={run.branch}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              title="Refresh"
              icon={Icon.ArrowClockwise}
              shortcut={Keyboard.Shortcut.Common.Refresh}
              onAction={rerun}
            />
            <Action.Push title="Show Raw Output" icon={Icon.Terminal} target={<RawOutput output={output} />} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

type EmptyProps = {
  status: "running" | "succeeded" | "failed";
  hint: string | undefined;
};

function emptyState({ status, hint }: EmptyProps): { icon: Icon; title: string; description: string } {
  switch (status) {
    case "running":
      return {
        icon: Icon.Globe,
        title: "Asking GitHub",
        description: "Fetching every open pull request you authored.",
      };
    case "failed":
      return { icon: Icon.XMarkCircle, title: "Could not reach GitHub", description: hint ?? "Run again to retry." };
    case "succeeded":
      return { icon: Icon.CheckRosette, title: "No open pull requests", description: hint ?? "Nothing to watch." };
  }
}

/** Not repo-scoped: che scans every repo the gh login owns, so it runs straight away. */
export function ActionsView() {
  const { state, rerun } = useCheRunner({ command, cwd: homedir(), dryRun: false });
  const running = state.status === "running";
  const runs = useMemo(() => parseActionRuns(state.output), [state.output]);
  const log = useMemo(() => parseRunLog(state.output), [state.output]);
  const live = runs.filter((run) => run.live);
  const settled = runs.filter((run) => !run.live);
  const failing = settled.filter((run) => statusLook(run.status).color === Color.Red).length;

  useEffect(() => {
    if (state.status === "failed") {
      showToast({ style: Toast.Style.Failure, title: "All Actions failed", message: state.error ?? lastWarning(log) });
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- fire once per status change, not when error/exitCode fill in
  }, [state.status]);

  const hint =
    state.error ?? lastWarning(log) ?? log.sections.flatMap((s) => s.lines).find((l) => l.kind === "info")?.text;
  const empty = emptyState({ status: state.status, hint });
  const refreshed = state.finishedAt === null ? "Refreshing" : `As of ${formatClock(state.finishedAt)}`;

  return (
    <List
      isLoading={running}
      navigationTitle="All Actions"
      searchBarPlaceholder="Search pull requests, branches, workflows"
      actions={
        <ActionPanel>
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={rerun}
          />
          <Action.Push title="Show Raw Output" icon={Icon.Terminal} target={<RawOutput output={state.output} />} />
        </ActionPanel>
      }
    >
      <List.EmptyView icon={empty.icon} title={empty.title} description={empty.description} />
      {!!live.length && (
        <List.Section title="In flight" subtitle={`${live.length} running`}>
          {live.map((run) => (
            <RunItem key={`${run.repo}#${run.number}`} run={run} rerun={rerun} output={state.output} />
          ))}
        </List.Section>
      )}
      {!!settled.length && (
        <List.Section
          title="Settled"
          subtitle={[`${settled.length} last run`, ...(failing ? [`${failing} failing`] : []), refreshed].join("  ")}
        >
          {settled.map((run) => (
            <RunItem key={`${run.repo}#${run.number}`} run={run} rerun={rerun} output={state.output} />
          ))}
        </List.Section>
      )}
    </List>
  );
}
