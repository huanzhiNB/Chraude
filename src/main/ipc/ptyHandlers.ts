import { ipcMain, type WebContents } from 'electron'
import { IPC } from '@shared/ipcChannels'
import type { PtyCreateOptions } from '@shared/types'
import { PtyManager } from '../pty/PtyManager'

export interface PtyHandlers {
  manager: PtyManager
  // A tab's WebContentsView never changes identity across a window move (see
  // the tab tear-off design), so session ownership never needs reassigning —
  // only cleared out when that view's tab is genuinely closed.
  killAllForOwner: (webContents: WebContents) => void
}

export function registerPtyHandlers(): PtyHandlers {
  const owners = new Map<string, WebContents>()

  function send(sessionId: string, channel: string, payload: unknown): void {
    const owner = owners.get(sessionId)
    if (owner && !owner.isDestroyed()) owner.send(channel, payload)
  }

  const manager = new PtyManager(
    (event) => send(event.sessionId, IPC.ptyData, event),
    (event) => {
      send(event.sessionId, IPC.ptyExit, event)
      owners.delete(event.sessionId)
    },
    (event) => send(event.sessionId, IPC.ptyTitle, event),
    (event) => send(event.sessionId, IPC.ptyCwd, event)
  )

  ipcMain.handle(IPC.ptyCreate, (event, opts: PtyCreateOptions) => {
    const sessionId = manager.create(opts)
    owners.set(sessionId, event.sender)
    return { sessionId }
  })

  ipcMain.on(IPC.ptyWrite, (_event, sessionId: string, data: string) => {
    manager.write(sessionId, data)
  })

  ipcMain.on(IPC.ptyResize, (_event, sessionId: string, cols: number, rows: number) => {
    manager.resize(sessionId, cols, rows)
  })

  ipcMain.on(IPC.ptyKill, (_event, sessionId: string) => {
    manager.kill(sessionId)
    owners.delete(sessionId)
  })

  function killAllForOwner(webContents: WebContents): void {
    for (const [sessionId, owner] of owners) {
      if (owner === webContents) {
        manager.kill(sessionId)
        owners.delete(sessionId)
      }
    }
  }

  return { manager, killAllForOwner }
}
