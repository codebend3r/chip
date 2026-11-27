import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { ActionsView } from "./actions-view";
import { CHE_COMMANDS, CHE_GROUPS, CheCommand, CheGroup } from "./lib/commands";
import { planMarkdown } from "./lib/plan";
import { RepoList } from "./repo-list";

type Tag = { value: string; color: Color };

/** The tags at the end of a row: whether a run can be previewed, and whether a live one deletes. */
function rowTags({ command }: { command: CheCommand }): List.Item.Accessory[] {
  return [
    ...(command.dryRun ? [{ tag: { value: "DRY", color: Color.Green }, tooltip: "Preview with ⌘⇧↩" }] : []),
    ...(command.removes ? [{ tag: { value: "LIVE", color: Color.Orange }, tooltip: command.removes }] : []),
  ];
}

function dryRunTag({ command }: { command: CheCommand }): Tag {
  return command.dryRun
    ? { value: "preview with ⌘⇧↩", color: Color.Green }
    : { value: "no preview", color: Color.SecondaryText };
}

function effectTag({ command }: { command: CheCommand }): Tag {
  return command.removes
    ? { value: "live run deletes", color: Color.Red }
    : { value: "removes nothing", color: Color.Green };
}

function scopeTag({ command }: { command: CheCommand }): Tag {
  return command.scope === "repo"
    ? { value: "one repo", color: Color.Blue }
    : { value: "every repo you own", color: Color.Purple };
}

/** A `che / Group` breadcrumb, the name as a `$` prompt, then the plan. */
function menuMarkdown({ command, group }: { command: CheCommand; group: CheGroup }): string {
  return [`\`che / ${group.title}\``, `# $ ${command.name}`, planMarkdown({ command })].join("\n\n");
}

type CommandDetailProps = {
  command: CheCommand;
  group: CheGroup;
};

/** Right-hand panel: the plan on top, then a table of what chip knows about the command. */
function CommandDetail({ command, group }: CommandDetailProps) {
  const invocation = ["che", command.name, ...command.args].join(" ");

  return (
    <List.Item.Detail
      markdown={menuMarkdown({ command, group })}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Command" icon={Icon.Terminal} text={invocation} />
          <List.Item.Detail.Metadata.Label title="Script" text={`bin/${command.script}`} />
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.TagList title="Dry Run">
            <List.Item.Detail.Metadata.TagList.Item
              text={dryRunTag({ command }).value}
              color={dryRunTag({ command }).color}
            />
          </List.Item.Detail.Metadata.TagList>
          <List.Item.Detail.Metadata.TagList title="Effect">
            <List.Item.Detail.Metadata.TagList.Item
              text={effectTag({ command }).value}
              color={effectTag({ command }).color}
            />
          </List.Item.Detail.Metadata.TagList>
          <List.Item.Detail.Metadata.TagList title="Runs In">
            <List.Item.Detail.Metadata.TagList.Item
              text={scopeTag({ command }).value}
              color={scopeTag({ command }).color}
            />
          </List.Item.Detail.Metadata.TagList>
        </List.Item.Detail.Metadata>
      }
    />
  );
}

/** Every che command in one list, grouped like che's own menu. Picking one opens its repo picker or its view. */
export function CommandMenu() {
  const commands = Object.values(CHE_COMMANDS);

  return (
    <List isShowingDetail navigationTitle="Chip" searchBarPlaceholder="Type to filter">
      {CHE_GROUPS.map((group) => (
        <List.Section key={group.key} title={group.title} subtitle={group.blurb}>
          {commands
            .filter((command) => command.group === group.key)
            .map((command) => (
              <List.Item
                key={command.name}
                icon={{ source: command.icon }}
                title={command.name}
                keywords={[command.title, group.title]}
                accessories={rowTags({ command })}
                detail={<CommandDetail command={command} group={group} />}
                actions={
                  <ActionPanel>
                    <ActionPanel.Section title={command.title}>
                      <Action.Push
                        title={command.scope === "repo" ? "Pick a Repo" : command.title}
                        icon={{ source: command.icon }}
                        target={command.scope === "repo" ? <RepoList command={command} /> : <ActionsView />}
                      />
                    </ActionPanel.Section>
                    <ActionPanel.Section>
                      <Action.CopyToClipboard
                        title="Copy Command"
                        content={["che", command.name, ...command.args].join(" ")}
                        shortcut={{ modifiers: ["cmd"], key: "c" }}
                      />
                    </ActionPanel.Section>
                  </ActionPanel>
                }
              />
            ))}
        </List.Section>
      ))}
    </List>
  );
}
