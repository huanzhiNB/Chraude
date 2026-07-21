import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { RecentDirectoryEntry } from '@shared/types'

const MAX_ENTRIES = 50

interface StoredEntry {
  path: string
  lastVisited: number
}

function splitPath(path: string): { name: string; parent: string } {
  const idx = path.lastIndexOf('/')
  if (idx === -1) return { name: path, parent: '' }
  return { name: path.slice(idx + 1), parent: path.slice(0, idx) || '/' }
}

// Backs the "Recent" directory list shown on a freshly opened pane — a
// lightweight, app-local history of directories the user has actually cd'd
// into (recorded whenever a pane's polled cwd changes — see shell.ts's
// getShellCwd — not a filesystem scan or shell history file), persisted to
// disk so it survives app restarts.
export class RecentDirectoriesStore {
  private entries: StoredEntry[] = []
  private readonly filePath = join(app.getPath('userData'), 'recent-directories.json')

  constructor() {
    this.load()
  }

  record(path: string): void {
    // The home directory itself isn't a useful "recent project" suggestion
    // — nearly every fresh pane starts there, which would otherwise clutter
    // the top of the list on every new tab.
    if (!path || path === '~') return

    this.entries = this.entries.filter((e) => e.path !== path)
    this.entries.unshift({ path, lastVisited: Date.now() })
    this.entries = this.entries.slice(0, MAX_ENTRIES)
    this.save()
  }

  list(limit = 5): RecentDirectoryEntry[] {
    return this.entries.slice(0, limit).map((e) => ({ path: e.path, ...splitPath(e.path) }))
  }

  private load(): void {
    try {
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) this.entries = parsed
    } catch {
      // First run, or a corrupt/missing file — start with an empty history.
      this.entries = []
    }
  }

  private save(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.entries))
    } catch (error) {
      console.error('[chraude] failed to persist recent directories', error)
    }
  }
}
