import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useState } from "react";
import { ActionsView } from "./actions-view";
import { CHE_COMMANDS, CHE_GROUPS, CheCommand, CheCommandName, CheGroup } from "./lib/commands";
import { EMBER, Pill, emberHead } from "./lib/ember";
import { stepsMarkdown } from "./lib/plan";
import { RepoList } from "./repo-list";

type CommandLook = {
  command: CheCommand;
  /** Whether the dry-run toggle is on for this command. */
  dry: boolean;
};

/** The badge at the end of a row: what Enter will do to the repo. */
function rowBadge({ command, dry }: CommandLook): Pill {
  if (command.scope === "global") return { text: "GitHub", color: EMBER.info };
  return command.dryRun && dry ? { text: "Preview", color: EMBER.good } : { text: "Live", color: EMBER.warn };
}

function dryRunPill({ command, dry }: CommandLook): Pill {
  if (!command.dryRun) return { text: "Not available", color: EMBER.muted };
  return dry ? { text: "On, previews only", color: EMBER.good } : { text: "Off, changes the repo", color: EMBER.warn };
}

function removesPill({ command }: { command: CheCommand }): Pill {
  return command.removes
    ? { text: "Deletes on a live run", color: EMBER.warn }
    : { text: "Nothing", color: EMBER.good };
}

function scopePill({ command }: { command: CheCommand }): Pill {
  return command.scope === "repo"
    ? { text: "One repo you pick", color: EMBER.info }
    : { text: "Every repo you own", color: EMBER.info };
}

function invocation({ command }: { command: CheCommand }): string {
  return ["che", command.name, ...command.args].join(" ");
}

type PillRowProps = {
  title: string;
  pill: Pill;
};

function PillRow({ title, pill }: PillRowProps) {
  return (
    <List.Item.Detail.Metadata.TagList title={title}>
      <List.Item.Detail.Metadata.TagList.Item text={pill.text} color={pill.color} />
    </List.Item.Detail.Metadata.TagList>
  );
}

type CommandDetailProps = CommandLook & {
  group: CheGroup;
};

/** Right-hand panel: the Ember head and the steps, then one key/value row per fact about the command. */
function CommandDetail({ command, group, dry }: CommandDetailProps) {
  const head = emberHead({ command, eyebrow: group.title, title: command.name, lead: command.summary });

  return (
    <List.Item.Detail
      markdown={[head, stepsMarkdown({ command })].join("\n\n")}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Command" text={invocation({ command })} />
          <List.Item.Detail.Metadata.Label title="Category" text={group.title} />
          <List.Item.Detail.Metadata.Label title="Script" text={`bin/${command.script}`} />
          <List.Item.Detail.Metadata.Label title="Needs" text={command.needs ?? "Nothing extra"} />
          <PillRow title="Dry Run" pill={dryRunPill({ command, dry })} />
          <PillRow title="Removes" pill={removesPill({ command })} />
          <PillRow title="Runs In" pill={scopePill({ command })} />
          <List.Item.Detail.Metadata.Label title="Flags" text={command.args.length ? command.args.join(" ") : "None"} />
        </List.Item.Detail.Metadata>
      }
    />
  );
}

type DryState = Partial<Record<CheCommandName, boolean>>;

/** Every che command in one list, grouped like che's own menu. Picking one opens its repo picker or its view. */
export function CommandMenu() {
  const commands = Object.values(CHE_COMMANDS);
  const [dryState, setDryState] = useState<DryState>({});
  const count = `${commands.length} ${commands.length === 1 ? "command" : "commands"}`;

  return (
    <List isShowingDetail navigationTitle={`Chip, ${count}`} searchBarPlaceholder="Search commands…">
      {CHE_GROUPS.map((group) => (
        <List.Section key={group.key} title={group.title.toUpperCase()} subtitle={group.blurb}>
          {commands
            .filter((command) => command.group === group.key)
            .map((command) => {
              const dry = command.dryRun && !!dryState[command.name];
              const badge = rowBadge({ command, dry });

              return (
                <List.Item
                  key={command.name}
                  icon={{ source: command.icon }}
                  title={command.name}
                  subtitle={command.summary}
                  keywords={[command.title, group.title]}
                  accessories={[{ tag: { value: badge.text, color: badge.color } }]}
                  detail={<CommandDetail command={command} group={group} dry={dry} />}
                  actions={
                    <ActionPanel>
                      <ActionPanel.Section title={command.title}>
                        <Action.Push
                          title={dry ? "Preview" : "Run"}
                          icon={dry ? Icon.Eye : { source: command.icon }}
                          target={
                            command.scope === "repo" ? (
                              <RepoList command={command} previewFirst={dry} />
                            ) : (
                              <ActionsView />
                            )
                          }
                        />
                        {command.dryRun && (
                          <Action
                            title={dry ? "Turn Dry Run off" : "Turn Dry Run on"}
                            icon={dry ? Icon.Bolt : Icon.Eye}
                            shortcut={{ modifiers: ["cmd"], key: "d" }}
                            onAction={() => setDryState((state) => ({ ...state, [command.name]: !dry }))}
                          />
                        )}
                      </ActionPanel.Section>
                      <ActionPanel.Section>
                        <Action.CopyToClipboard
                          title="Copy Command"
                          content={invocation({ command })}
                          shortcut={{ modifiers: ["cmd"], key: "c" }}
                        />
                      </ActionPanel.Section>
                    </ActionPanel>
                  }
                />
              );
            })}
        </List.Section>
      ))}
    </List>
  );
}
