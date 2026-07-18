import { randomUUID } from 'node:crypto'
import type { IPty } from 'node-pty'
import type {
  PtyCreateOptions,
  PtyCwdEvent,
  PtyDataEvent,
  PtyExitEvent,
  PtyTitleEvent
} from '@shared/types'
import { getShellCwd, spawnSession } from './shell'

const MAX_DIMENSION = 1000
const POLL_INTERVAL_MS = 1500

export class PtyManager {
  private sessions = new Map<string, IPty>()
  private pollIntervals = new Map<string, NodeJS.Timeout>()
  private lastTitles = new Map<string, string>()
  private lastCwds = new Map<string, string>()

  constructor(
    private onData: (event: PtyDataEvent) => void,
    private onExit: (event: PtyExitEvent) => void,
    private onTitle: (event: PtyTitleEvent) => void,
    private onCwd: (event: PtyCwdEvent) => void
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
      this.stopPolling(sessionId)
      this.sessions.delete(sessionId)
      this.onExit({ sessionId, exitCode, signal })
    })

    this.sessions.set(sessionId, ptyProcess)
    this.startPolling(sessionId, ptyProcess)
    return sessionId
  }

  write(sessionId: string, data: string): void {
    this.sessions.get(sessionId)?.write(data)
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.sessions.get(sessionId)?.resize(clampDimension(cols), clampDimension(rows))
  }

  kill(sessionId: string): void {
    this.stopPolling(sessionId)
    this.sessions.get(sessionId)?.kill()
    this.sessions.delete(sessionId)
  }

  killAll(): void {
    for (const sessionId of this.sessions.keys()) {
      this.stopPolling(sessionId)
    }
    for (const ptyProcess of this.sessions.values()) {
      ptyProcess.kill()
    }
    this.sessions.clear()
  }

  // node-pty exposes the foreground process's name (the same technique
  // Terminal.app/iTerm2 use for tab titles) but no change event for it, and
  // no cwd API at all (cwd is read separately via lsof — see shell.ts), so
  // both are polled at a modest shared interval and only reported on change.
  private startPolling(sessionId: string, ptyProcess: IPty): void {
    const interval = setInterval(() => {
      try {
        const title = ptyProcess.process
        if (title && title !== this.lastTitles.get(sessionId)) {
          this.lastTitles.set(sessionId, title)
          this.onTitle({ sessionId, title })
        }
      } catch {
        // pty likely exited between poll tick and this read; ignored.
      }

      const cwd = getShellCwd(ptyProcess.pid)
      if (cwd && cwd !== this.lastCwds.get(sessionId)) {
        this.lastCwds.set(sessionId, cwd)
        this.onCwd({ sessionId, cwd })
      }
    }, POLL_INTERVAL_MS)
    this.pollIntervals.set(sessionId, interval)
  }

  private stopPolling(sessionId: string): void {
    const interval = this.pollIntervals.get(sessionId)
    if (interval) clearInterval(interval)
    this.pollIntervals.delete(sessionId)
    this.lastTitles.delete(sessionId)
    this.lastCwds.delete(sessionId)
  }
}

function clampDimension(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 1
  return Math.min(Math.floor(value), MAX_DIMENSION)
}
