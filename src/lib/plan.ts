import { CheCommand } from "./commands";

type PlanOptions = {
  command: CheCommand;
};

/** What a run does, in the script's own order. */
export function stepsMarkdown({ command }: PlanOptions): string {
  return command.steps.map((step, i) => `${command.ordered ? `${i + 1}.` : "-"} ${step}`).join("\n");
}

/** What a run removes and whether it can preview. Empty when the command does neither. */
export function notesMarkdown({ command }: PlanOptions): string {
  return [
    ...(command.removes ? [`**Removes** ${command.removes}`] : []),
    ...(command.dryRun ? ["**Preview** with ⌘⇧↩ to see the plan without changing anything."] : []),
  ].join("  \n");
}
