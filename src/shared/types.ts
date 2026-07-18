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
