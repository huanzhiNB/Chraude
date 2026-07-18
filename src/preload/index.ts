import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipcChannels'
import type {
  PtyCreateOptions,
  PtyCreateResult,
  PtyDataEvent,
  PtyExitEvent,
  PtyTitleEvent
} from '@shared/types'

function subscribe<Args extends unknown[]>(
  channel: string,
  cb: (...args: Args) => void
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, ...args: Args): void => cb(...args)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const chraudeAPI = {
  pty: {
    create: (opts: PtyCreateOptions): Promise<PtyCreateResult> =>
      ipcRenderer.invoke(IPC.ptyCreate, opts),
    write: (sessionId: string, data: string): void => {
      ipcRenderer.send(IPC.ptyWrite, sessionId, data)
    },
    resize: (sessionId: string, cols: number, rows: number): void => {
      ipcRenderer.send(IPC.ptyResize, sessionId, cols, rows)
    },
    kill: (sessionId: string): void => {
      ipcRenderer.send(IPC.ptyKill, sessionId)
    },
    onData: (cb: (event: PtyDataEvent) => void): (() => void) => subscribe(IPC.ptyData, cb),
    onExit: (cb: (event: PtyExitEvent) => void): (() => void) => subscribe(IPC.ptyExit, cb),
    onTitle: (cb: (event: PtyTitleEvent) => void): (() => void) => subscribe(IPC.ptyTitle, cb)
  },
  menu: {
    onNewTab: (cb: () => void): (() => void) => subscribe(IPC.menuNewTab, cb),
    onClose: (cb: () => void): (() => void) => subscribe(IPC.menuClose, cb),
    onSelectTab: (cb: (index: number) => void): (() => void) => subscribe(IPC.menuSelectTab, cb),
    onSplitRight: (cb: () => void): (() => void) => subscribe(IPC.menuSplitRight, cb),
    onSplitDown: (cb: () => void): (() => void) => subscribe(IPC.menuSplitDown, cb)
  }
}

export type ChraudeAPI = typeof chraudeAPI

// contextIsolation is always on (see BrowserWindow webPreferences), so this
// is the only path exercised; the else-branch below only matters if that
// ever changes.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('chraude', chraudeAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.chraude = chraudeAPI
}
