import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipcChannels'
import type {
  ChromeTabsChangedEvent,
  PtyCreateOptions,
  PtyCreateResult,
  PtyCwdEvent,
  PtyDataEvent,
  PtyExitEvent,
  PtyRunningClaudeEvent,
  PtyTitleEvent,
  RecentDirectoryEntry,
  SavedSession,
  ScreenPoint
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
    onTitle: (cb: (event: PtyTitleEvent) => void): (() => void) => subscribe(IPC.ptyTitle, cb),
    onCwd: (cb: (event: PtyCwdEvent) => void): (() => void) => subscribe(IPC.ptyCwd, cb),
    onRunningClaude: (cb: (event: PtyRunningClaudeEvent) => void): (() => void) =>
      subscribe(IPC.ptyRunningClaude, cb)
  },
  menu: {
    onNewTab: (cb: () => void): (() => void) => subscribe(IPC.menuNewTab, cb),
    onClose: (cb: () => void): (() => void) => subscribe(IPC.menuClose, cb),
    onSelectTab: (cb: (index: number) => void): (() => void) => subscribe(IPC.menuSelectTab, cb),
    onSplitRight: (cb: () => void): (() => void) => subscribe(IPC.menuSplitRight, cb),
    onSplitDown: (cb: () => void): (() => void) => subscribe(IPC.menuSplitDown, cb)
  },
  chrome: {
    newTab: (launchCommand?: string, initialTitle?: string): void =>
      ipcRenderer.send(IPC.chromeNewTab, launchCommand, initialTitle),
    closeTab: (tabId: string): void => ipcRenderer.send(IPC.chromeCloseTab, tabId),
    activateTab: (tabId: string): void => ipcRenderer.send(IPC.chromeActivateTab, tabId),
    detachTab: (tabId: string, screenPoint: { x: number; y: number }): void =>
      ipcRenderer.send(IPC.chromeDetachTab, tabId, screenPoint),
    getTabs: (): Promise<ChromeTabsChangedEvent> => ipcRenderer.invoke(IPC.chromeGetTabs),
    setTabViewVisible: (visible: boolean): void =>
      ipcRenderer.send(IPC.chromeSetTabViewVisible, visible),
    onTabsChanged: (cb: (event: ChromeTabsChangedEvent) => void): (() => void) =>
      subscribe(IPC.chromeTabsChanged, cb)
  },
  tab: {
    reportTitle: (tabId: string, title: string): void => {
      ipcRenderer.send(IPC.tabReportTitle, tabId, title)
    },
    reportCwd: (tabId: string, cwd: string): void => {
      ipcRenderer.send(IPC.tabReportCwd, tabId, cwd)
    },
    reportRunningClaude: (tabId: string, running: boolean): void => {
      ipcRenderer.send(IPC.tabReportRunningClaude, tabId, running)
    }
  },
  system: {
    getCursorScreenPoint: (): Promise<ScreenPoint> => ipcRenderer.invoke(IPC.systemGetCursorPoint)
  },
  recent: {
    getDirectories: (limit?: number): Promise<RecentDirectoryEntry[]> =>
      ipcRenderer.invoke(IPC.recentGetDirectories, limit)
  },
  saved: {
    saveCurrentSession: (cwd: string, title: string): Promise<SavedSession | null> =>
      ipcRenderer.invoke(IPC.savedSaveSession, { cwd, title }),
    getSessions: (): Promise<SavedSession[]> => ipcRenderer.invoke(IPC.savedGetSessions)
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
