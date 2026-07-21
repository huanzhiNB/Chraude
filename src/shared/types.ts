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

export interface ChromeTabSummary {
  id: string
  title: string
  cwd: string
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
