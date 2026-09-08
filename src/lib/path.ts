/** Raycast launches node with a bare PATH; git, gh, and python live here on macOS. */
export const EXTRA_PATH = [
  "/opt/homebrew/bin",
  "/opt/homebrew/sbin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
];

/** The PATH every child process gets: EXTRA_PATH first, then whatever Raycast passed. */
export function spawnPath(): string {
  return [...EXTRA_PATH, process.env.PATH ?? ""].filter(Boolean).join(":");
}
