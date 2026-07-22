// Paths handed around the app (RecentDirectoryEntry, SavedSession.cwd) are
// already `~`-abbreviated (see main/pty/shell.ts's getShellCwd). Wrapping a
// leading `~` in double quotes would suppress the shell's tilde expansion, so
// it's kept outside the quoted segment — zsh (Chraude's login shell) still
// expands a `~` immediately followed by a quoted continuation, e.g.
// `~"/Huanzhi/msp-ios-sdk"`.
export function quoteShellPath(path: string): string {
  const escaped = path.replace(/"/g, '\\"')
  return path.startsWith('~') ? `~"${escaped.slice(1)}"` : `"${escaped}"`
}
