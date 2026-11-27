import { CheCommand } from "./commands";

type PlanMarkdownOptions = {
  command: CheCommand;
};

/** What a run does, in the script's own order, then what it removes, needs and can preview. */
export function planMarkdown({ command }: PlanMarkdownOptions): string {
  const steps = command.steps.map((step, i) => `${command.ordered ? `${i + 1}.` : "-"} ${step}`);
  const notes = [
    ...(command.removes ? [`**Removes** ${command.removes}`] : []),
    ...(command.needs ? [`**Needs** ${command.needs}`] : []),
    ...(command.dryRun ? ["**Preview** with ⌘⇧↩ to see the plan without changing anything."] : []),
  ];
  return [command.summary, steps.join("\n"), notes.join("  \n")].join("\n\n");
}
