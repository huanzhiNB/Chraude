import { ipcMain, type WebContents } from 'electron'
import { IPC } from '@shared/ipcChannels'
import type { PtyCreateOptions } from '@shared/types'
import { PtyManager } from '../pty/PtyManager'

export function registerPtyHandlers(getWebContents: () => WebContents | undefined): PtyManager {
  const manager = new PtyManager(
    (event) => getWebContents()?.send(IPC.ptyData, event),
    (event) => getWebContents()?.send(IPC.ptyExit, event),
    (event) => getWebContents()?.send(IPC.ptyTitle, event)
  )

  ipcMain.handle(IPC.ptyCreate, (_event, opts: PtyCreateOptions) => {
    const sessionId = manager.create(opts)
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
  })

  return manager
}
