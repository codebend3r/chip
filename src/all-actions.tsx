import { CHE_COMMANDS } from "./lib/commands";
import { RunView } from "./run-view";

/** Not repo-scoped: che scans every repo the gh login owns, so it runs straight away. */
export default function Command() {
  return <RunView command={CHE_COMMANDS["all-actions"]} dryRun={false} />;
}
