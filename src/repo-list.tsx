import { homedir } from "node:os";
import { Action, ActionPanel, Color, Icon, List, getPreferenceValues } from "@raycast/api";
import { useCachedPromise, useFrecencySorting } from "@raycast/utils";
import { useMemo, useState } from "react";
import { CHE_GROUPS, CheCommand } from "./lib/commands";
import { EMBER, emberHead } from "./lib/ember";
import { RepoInspection, inspectRepo } from "./lib/inspect";
import { notesMarkdown, stepsMarkdown } from "./lib/plan";
import { mdEscape } from "./lib/render-log";
import { Repo, defaultReposRoot, expandHome, findRepos } from "./lib/repos";
import { RunView } from "./run-view";

type RepoListProps = {
  command: CheCommand;
  /** Makes the preview the Enter action and the live run the secondary one. Ignored when the command has no dry run. */
  previewFirst?: boolean;
};

function tilde(path: string): string {
  const home = homedir();
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

/** What the command will do to this repo, in the script's own order. */
function briefing({ command, repo }: { command: CheCommand; repo: Repo }): string {
  const head = emberHead({
    command,
    eyebrow: `${CHE_GROUPS[command.group].title} / ${command.name}`,
    title: mdEscape(repo.name),
    lead: command.summary,
  });
  return [head, stepsMarkdown({ command }), notesMarkdown({ command })].filter((part) => !!part).join("\n\n");
}

type SyncText = { value: string; color: Color };

function syncText(info: RepoInspection): SyncText {
  if (!info.upstream) return { value: "No upstream", color: Color.SecondaryText };
  if (!info.ahead && !info.behind) return { value: "Up to date", color: Color.Green };
  const parts = [...(info.ahead ? [`${info.ahead} ahead`] : []), ...(info.behind ? [`${info.behind} behind`] : [])];
  return { value: parts.join(", "), color: Color.Yellow };
}

function countText({ count, noun, alarm }: { count: number; noun: string; alarm: boolean }): SyncText {
  if (!count) return { value: `No ${noun}s`, color: Color.SecondaryText };
  const value = `${count} ${noun}${count === 1 ? "" : "s"}`;
  return { value, color: alarm ? Color.Red : Color.PrimaryText };
}

type RepoBriefingProps = {
  command: CheCommand;
  repo: Repo;
};

/**
 * Right-hand panel: the plan on top, the repo's live git state underneath.
 * Only the selected row mounts this, so git is asked about one repo at a time;
 * the cache makes flipping back to a repo instant.
 */
function RepoBriefing({ command, repo }: RepoBriefingProps) {
  const { data, isLoading } = useCachedPromise(inspectRepo, [{ path: repo.path }], { keepPreviousData: false });
  const changes = data ? countText({ count: data.changes, noun: "change", alarm: false }) : null;

  return (
    <List.Item.Detail
      isLoading={isLoading}
      markdown={briefing({ command, repo })}
      metadata={
        !!data && (
          <List.Item.Detail.Metadata>
            <List.Item.Detail.Metadata.Label
              title="Branch"
              icon={Icon.Leaf}
              text={{ value: data.branch ?? "Detached", color: data.branch ? Color.PrimaryText : Color.Orange }}
            />
            <List.Item.Detail.Metadata.Label title="Upstream" text={syncText(data)} />
            {!!changes && <List.Item.Detail.Metadata.Label title="Working Tree" text={changes} />}
            <List.Item.Detail.Metadata.Separator />
            <List.Item.Detail.Metadata.Label
              title="Branches"
              text={countText({ count: data.branches, noun: "branch", alarm: false })}
            />
            <List.Item.Detail.Metadata.Label
              title="Stale"
              text={countText({ count: data.stale, noun: "gone upstream", alarm: !!command.removes })}
            />
            <List.Item.Detail.Metadata.Label
              title="Worktrees"
              text={countText({ count: data.worktrees, noun: "linked worktree", alarm: !!command.removes })}
            />
            {!!data.lastCommit && (
              <>
                <List.Item.Detail.Metadata.Separator />
                <List.Item.Detail.Metadata.Label title="Last Commit" text={data.lastCommit.subject} />
                <List.Item.Detail.Metadata.Label
                  title={data.lastCommit.sha}
                  text={{ value: data.lastCommit.when, color: Color.SecondaryText }}
                />
              </>
            )}
            {!!repo.remoteUrl && (
              <>
                <List.Item.Detail.Metadata.Separator />
                <List.Item.Detail.Metadata.Link
                  title="Remote"
                  target={repo.remoteUrl}
                  text={repo.remoteUrl.replace(/^https?:\/\//, "")}
                />
              </>
            )}
          </List.Item.Detail.Metadata>
        )
      }
    />
  );
}

type RunActionProps = {
  command: CheCommand;
  repo: Repo;
  dryRun: boolean;
  /** The Enter action. The secondary one takes the shortcut and says which kind of run it is. */
  primary: boolean;
  onPush: () => void;
};

function RunAction({ command, repo, dryRun, primary, onPush }: RunActionProps) {
  const live = primary
    ? { title: command.title, icon: { source: command.icon } }
    : { title: "Run for Real", icon: Icon.Bolt };
  const look = dryRun ? { title: "Preview Changes", icon: Icon.Eye } : live;

  return (
    <Action.Push
      title={look.title}
      icon={look.icon}
      shortcut={primary ? undefined : { modifiers: ["cmd", "shift"], key: "enter" }}
      onPush={onPush}
      target={<RunView command={command} repo={repo} dryRun={dryRun} />}
    />
  );
}

/** Repo picker shared by every repo-scoped command. Picking a repo pushes RunView. */
export function RepoList({ command, previewFirst = false }: RepoListProps) {
  const prefs = getPreferenceValues<Preferences>();
  const root = prefs.reposRoot?.trim() ? expandHome(prefs.reposRoot.trim()) : defaultReposRoot();
  const repos = useMemo(() => findRepos({ root }), [root]);
  const { data: sorted, visitItem } = useFrecencySorting(repos, { key: (repo) => repo.path });
  const [selected, setSelected] = useState<string | null>(null);
  // Enter runs the first mode; the other one, when the command can preview, sits on ⌘⇧↩.
  const modes = command.dryRun ? (previewFirst ? [true, false] : [false, true]) : [false];

  return (
    <List
      isShowingDetail
      navigationTitle={command.title}
      searchBarPlaceholder="Search repos"
      onSelectionChange={setSelected}
    >
      <List.EmptyView
        icon={Icon.Folder}
        title="No git repos found"
        description={`Nothing under ${tilde(root)}. Set Repos Root in the extension preferences.`}
      />
      <List.Section title={tilde(root)} subtitle={`${repos.length} ${repos.length === 1 ? "repo" : "repos"}`}>
        {sorted.map((repo) => (
          <List.Item
            key={repo.path}
            id={repo.path}
            icon={{ source: Icon.Folder, tintColor: selected === repo.path ? EMBER.accent : EMBER.muted }}
            title={repo.name}
            keywords={[repo.relativePath, ...(repo.branch ? [repo.branch] : [])]}
            accessories={
              repo.branch
                ? [{ tag: { value: repo.branch, color: repo.branch === "main" ? EMBER.good : EMBER.info } }]
                : [{ tag: { value: "detached", color: EMBER.warn } }]
            }
            detail={
              selected === repo.path ? (
                <RepoBriefing command={command} repo={repo} />
              ) : (
                <List.Item.Detail markdown={briefing({ command, repo })} />
              )
            }
            actions={
              <ActionPanel>
                <ActionPanel.Section title={repo.name}>
                  {modes.map((dryRun, i) => (
                    <RunAction
                      key={String(dryRun)}
                      command={command}
                      repo={repo}
                      dryRun={dryRun}
                      primary={i === 0}
                      onPush={() => visitItem(repo)}
                    />
                  ))}
                </ActionPanel.Section>
                <ActionPanel.Section>
                  {!!repo.remoteUrl && (
                    <Action.OpenInBrowser
                      title="Open on GitHub"
                      icon={Icon.Globe}
                      url={repo.remoteUrl}
                      shortcut={{ modifiers: ["cmd"], key: "o" }}
                    />
                  )}
                  <Action.ShowInFinder path={repo.path} />
                  <Action.CopyToClipboard
                    title="Copy Path"
                    content={repo.path}
                    shortcut={{ modifiers: ["cmd"], key: "c" }}
                  />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
