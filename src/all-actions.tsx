import { ActionsView } from "./actions-view";

/** Not repo-scoped: che scans every repo the gh login owns, so it renders the list straight away. */
export default function Command() {
  return <ActionsView />;
}
