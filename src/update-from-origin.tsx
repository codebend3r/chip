import { CHE_COMMANDS } from "./lib/commands";
import { RepoList } from "./repo-list";

export default function Command() {
  return <RepoList command={CHE_COMMANDS["update-from-origin"]} />;
}
