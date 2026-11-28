import { homedir } from "node:os";
import { Action, ActionPanel, Color, Detail, Icon, Keyboard, List, Toast, showToast } from "@raycast/api";
import { useEffect, useMemo } from "react";
import { ActionRun, parseActionRuns, parseBranchRuns, pullRequestUrl } from "./lib/actions";
import { CHE_COMMANDS } from "./lib/commands";
import { EMBER } from "./lib/ember";
import { formatClock } from "./lib/duration";
import { lastWarning, parseRunLog, stripAnsi } from "./lib/log";
import { useCheRunner } from "./lib/runner";

const command = CHE_COMMANDS["all-actions"];

type StatusLook = { icon: Icon; color: Color.ColorLike; label: string };

/** Mirrors STATUS_ICONS in all-actions.py, with Raycast's own icons and one color per outcome. */
function statusLook({ status, failed }: ActionRun): StatusLook {
  if (failed) return { icon: Icon.XMarkCircle, color: EMBER.danger, label: status.replace(/_/g, " ") };
  switch (status) {
    case "in_progress":
      return { icon: Icon.CircleProgress, color: EMBER.info, label: "Running" };
    case "queued":
    case "waiting":
    case "pending":
    case "requested":
      return { icon: Icon.Clock, color: EMBER.warn, label: "Queued" };
    case "success":
      return { icon: Icon.CheckCircle, color: EMBER.good, label: "Passed" };
    case "cancelled":
      return { icon: Icon.Stop, color: EMBER.muted, label: "Cancelled" };
    case "skipped":
      return { icon: Icon.Forward, color: EMBER.muted, label: "Skipped" };
    case "none":
      return { icon: Icon.Minus, color: EMBER.muted, label: "No runs" };
    default:
      return { icon: Icon.QuestionMark, color: EMBER.muted, label: status };
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
  const look = statusLook(run);
  const prUrl = pullRequestUrl(run);
  const runUrl = run.url && run.url !== prUrl ? run.url : undefined;
  const pr = run.number === undefined ? undefined : `#${run.number}`;

  return (
    <List.Item
      icon={{ source: look.icon, tintColor: look.color }}
      title={run.repo}
      subtitle={run.branch}
      keywords={[run.workflow, run.status, ...(pr ? [pr] : [])]}
      accessories={[
        { text: run.workflow, tooltip: "Workflow" },
        { tag: { value: look.label, color: look.color } },
        ...(run.took !== "-" ? [{ text: run.took, icon: Icon.Clock, tooltip: "Run duration" }] : []),
        pr ? { text: pr, tooltip: `Opened ${run.age} ago` } : { text: run.age, tooltip: "Since the run" },
      ]}
      actions={
        <ActionPanel>
          <ActionPanel.Section title={pr ? `${run.repo} ${pr}` : run.repo}>
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

type RunSectionProps = {
  title: string;
  /** What the count is a count of, e.g. `3 last run`. */
  counted: string;
  /** Appended to the subtitle after the count and the failures. */
  note?: string;
  runs: readonly ActionRun[];
  rerun: () => void;
  output: string;
};

/** One titled group of runs; renders nothing when the group is empty. */
function RunSection({ title, counted, note, runs, rerun, output }: RunSectionProps) {
  const failing = runs.filter((run) => run.failed).length;
  const subtitle = [counted, ...(failing ? [`${failing} failing`] : []), ...(note ? [note] : [])].join("  ");

  return (
    !!runs.length && (
      <List.Section title={title} subtitle={subtitle}>
        {runs.map((run) => (
          <RunItem key={`${run.repo}#${run.number ?? run.branch}`} run={run} rerun={rerun} output={output} />
        ))}
      </List.Section>
    )
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
  const branches = useMemo(() => parseBranchRuns(state.output), [state.output]);
  const live = runs.filter((run) => run.live);
  const settled = runs.filter((run) => !run.live);

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
      <RunSection
        title="In flight"
        counted={`${live.length} running`}
        runs={live}
        rerun={rerun}
        output={state.output}
      />
      <RunSection
        title="Settled"
        counted={`${settled.length} last run`}
        note={refreshed}
        runs={settled}
        rerun={rerun}
        output={state.output}
      />
      <RunSection
        title="Default branches"
        counted={`${branches.length} ${branches.length === 1 ? "repo" : "repos"}`}
        runs={branches}
        rerun={rerun}
        output={state.output}
      />
    </List>
  );
}
