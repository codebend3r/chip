import { Action, ActionPanel, Color, Icon, List, getPreferenceValues } from "@raycast/api";
import { useMemo } from "react";
import { expandHome } from "./lib/che";
import { defaultReposRoot, findRepos } from "./lib/repos";
import { RunView } from "./run-view";

export default function Command() {
  const prefs = getPreferenceValues<Preferences.SyncAllBranches>();
  const root = prefs.reposRoot?.trim() ? expandHome(prefs.reposRoot.trim()) : defaultReposRoot();
  const repos = useMemo(() => findRepos({ root }), [root]);

  return (
    <List navigationTitle="Sync All Branches" searchBarPlaceholder="Pick a repo to sync">
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
                    title="Sync All Branches"
                    icon={Icon.ArrowClockwise}
                    target={<RunView repo={repo} dryRun={false} />}
                  />
                  <Action.Push
                    title="Preview (Dry Run)"
                    icon={Icon.Eye}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
                    target={<RunView repo={repo} dryRun />}
                  />
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
