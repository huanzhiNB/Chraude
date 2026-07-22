import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import type { SavedSession } from '@shared/types'

const MAX_ENTRIES = 100

export class SavedSessionsStore {
  private entries: SavedSession[] = []
  private readonly filePath = join(app.getPath('userData'), 'saved-sessions.json')

  constructor() {
    this.load()
  }

  list(): SavedSession[] {
    return this.entries
  }

  add(entry: Omit<SavedSession, 'id'>): SavedSession {
    const saved: SavedSession = { id: randomUUID(), ...entry }
    // Re-saving the same Claude session just refreshes its position/title
    // rather than piling up duplicate entries.
    this.entries = this.entries.filter((e) => e.sessionId !== entry.sessionId)
    this.entries.unshift(saved)
    this.entries = this.entries.slice(0, MAX_ENTRIES)
    this.save()
    return saved
  }

  private load(): void {
    try {
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) this.entries = parsed
    } catch {
      this.entries = []
    }
  }

  private save(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.entries))
    } catch (error) {
      console.error('[chraude] failed to persist saved sessions', error)
    }
  }
}
