export interface PtyCreateOptions {
  cols: number
  rows: number
  cwd?: string
}

export interface PtyCreateResult {
  sessionId: string
}

export interface PtyDataEvent {
  sessionId: string
  chunk: string
}

export interface PtyExitEvent {
  sessionId: string
  exitCode: number
  signal?: number
}

export interface PtyTitleEvent {
  sessionId: string
  title: string
}

export interface PtyCwdEvent {
  sessionId: string
  cwd: string
}

export interface PtyRunningClaudeEvent {
  sessionId: string
  running: boolean
}

export interface ChromeTabSummary {
  id: string
  title: string
  cwd: string
  runningClaude: boolean
}

export interface ChromeTabsChangedEvent {
  tabs: ChromeTabSummary[]
  activeTabId: string | null
}

export interface ScreenPoint {
  x: number
  y: number
}

export interface RecentDirectoryEntry {
  // Full path as recorded (already ~-abbreviated by shell.ts's getShellCwd).
  path: string
  // Last path segment, e.g. "msp-ios-sdk" — shown as the entry's title.
  name: string
  // Everything before that, e.g. "~/Huanzhi" — shown as secondary text.
  parent: string
}

export interface SavedSession {
  id: string
  // Claude Code's own session id — the filename (sans .jsonl) of its
  // transcript under ~/.claude/projects/<sanitized-cwd>/, and what
  // `claude --resume <id>` expects.
  sessionId: string
  // The tab's title at save time (its OSC-set conversation title, if any).
  title: string
  // ~-abbreviated, for display and for re-launching via quoteShellPath.
  cwd: string
  savedAt: number
}
