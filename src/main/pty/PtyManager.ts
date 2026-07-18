import { randomUUID } from 'node:crypto'
import type { IPty } from 'node-pty'
import type { PtyCreateOptions, PtyDataEvent, PtyExitEvent, PtyTitleEvent } from '@shared/types'
import { spawnSession } from './shell'

const MAX_DIMENSION = 1000
const TITLE_POLL_INTERVAL_MS = 1500

export class PtyManager {
  private sessions = new Map<string, IPty>()
  private titleIntervals = new Map<string, NodeJS.Timeout>()
  private lastTitles = new Map<string, string>()

  constructor(
    private onData: (event: PtyDataEvent) => void,
    private onExit: (event: PtyExitEvent) => void,
    private onTitle: (event: PtyTitleEvent) => void
  ) {}

  create(opts: PtyCreateOptions): string {
    const cols = clampDimension(opts.cols)
    const rows = clampDimension(opts.rows)
    const sessionId = randomUUID()
    const ptyProcess = spawnSession({ ...opts, cols, rows })

    ptyProcess.onData((chunk) => {
      this.onData({ sessionId, chunk })
    })
    ptyProcess.onExit(({ exitCode, signal }) => {
      this.stopTitlePolling(sessionId)
      this.sessions.delete(sessionId)
      this.onExit({ sessionId, exitCode, signal })
    })

    this.sessions.set(sessionId, ptyProcess)
    this.startTitlePolling(sessionId, ptyProcess)
    return sessionId
  }

  write(sessionId: string, data: string): void {
    this.sessions.get(sessionId)?.write(data)
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.sessions.get(sessionId)?.resize(clampDimension(cols), clampDimension(rows))
  }

  kill(sessionId: string): void {
    this.stopTitlePolling(sessionId)
    this.sessions.get(sessionId)?.kill()
    this.sessions.delete(sessionId)
  }

  killAll(): void {
    for (const sessionId of this.sessions.keys()) {
      this.stopTitlePolling(sessionId)
    }
    for (const ptyProcess of this.sessions.values()) {
      ptyProcess.kill()
    }
    this.sessions.clear()
  }

  // node-pty exposes the foreground process's name (the same technique
  // Terminal.app/iTerm2 use for tab titles) but not a change event for it,
  // so poll at a modest interval and only notify on an actual change.
  private startTitlePolling(sessionId: string, ptyProcess: IPty): void {
    const interval = setInterval(() => {
      let title: string
      try {
        title = ptyProcess.process
      } catch {
        return
      }
      if (title && title !== this.lastTitles.get(sessionId)) {
        this.lastTitles.set(sessionId, title)
        this.onTitle({ sessionId, title })
      }
    }, TITLE_POLL_INTERVAL_MS)
    this.titleIntervals.set(sessionId, interval)
  }

  private stopTitlePolling(sessionId: string): void {
    const interval = this.titleIntervals.get(sessionId)
    if (interval) clearInterval(interval)
    this.titleIntervals.delete(sessionId)
    this.lastTitles.delete(sessionId)
  }
}

function clampDimension(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 1
  return Math.min(Math.floor(value), MAX_DIMENSION)
}
