import { Action, ActionPanel, Color, Icon, List, getPreferenceValues } from "@raycast/api";
import { useMemo } from "react";
import { CheCommand } from "./lib/commands";
import { defaultReposRoot, expandHome, findRepos } from "./lib/repos";
import { RunView } from "./run-view";

type RepoListProps = {
  command: CheCommand;
};

/** Repo picker shared by every repo-scoped command. Picking a repo pushes RunView. */
export function RepoList({ command }: RepoListProps) {
  const prefs = getPreferenceValues<Preferences>();
  const root = prefs.reposRoot?.trim() ? expandHome(prefs.reposRoot.trim()) : defaultReposRoot();
  const repos = useMemo(() => findRepos({ root }), [root]);

  return (
    <List navigationTitle={command.title} searchBarPlaceholder={`Pick a repo to run ${command.name} in`}>
      <List.EmptyView
        icon={Icon.Folder}
        title="No git repos found"
        description={`Nothing under ${root}. Set Repos Root in the extension preferences.`}
      />
      <List.Section title={root} subtitle={`${repos.length} repos`}>
        {repos.map((repo) => (
          <List.Item
            key={repo.path}
            icon={Icon.Folder}
            title={repo.name}
            subtitle={repo.relativePath === repo.name ? undefined : repo.relativePath}
            accessories={
              repo.branch
                ? [{ tag: { value: repo.branch, color: repo.branch === "main" ? Color.Green : Color.Blue } }]
                : []
            }
            actions={
              <ActionPanel>
                <ActionPanel.Section title={repo.name}>
                  <Action.Push
                    title={command.title}
                    icon={{ source: command.icon }}
                    target={<RunView command={command} repo={repo} dryRun={false} />}
                  />
                  {command.dryRun && (
                    <Action.Push
                      title="Preview (Dry Run)"
                      icon={Icon.Eye}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
                      target={<RunView command={command} repo={repo} dryRun />}
                    />
                  )}
                </ActionPanel.Section>
                <ActionPanel.Section>
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
