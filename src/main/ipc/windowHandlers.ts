import { homedir } from 'node:os'
import { join } from 'node:path'
import { ipcMain, screen, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipcChannels'
import type { ScreenPoint } from '@shared/types'
import type { WindowManager } from '../windows/WindowManager'
import type { RecentDirectoriesStore } from '../recent/RecentDirectoriesStore'
import type { SavedSessionsStore } from '../saved/SavedSessionsStore'
import { findLatestClaudeSessionId } from '../saved/claudeSessions'

function expandHome(cwd: string): string {
  return cwd.startsWith('~') ? join(homedir(), cwd.slice(1)) : cwd
}

export function registerWindowHandlers(
  windowManager: WindowManager,
  recentDirectories: RecentDirectoriesStore,
  savedSessions: SavedSessionsStore
): void {
  ipcMain.on(IPC.chromeNewTab, (event, launchCommand?: string, initialTitle?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) windowManager.createTab(win.id, launchCommand, initialTitle)
  })

  ipcMain.on(IPC.chromeCloseTab, (_event, tabId: string) => {
    windowManager.closeTab(tabId)
  })

  ipcMain.on(IPC.chromeActivateTab, (event, tabId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) windowManager.activateTab(win.id, tabId)
  })

  ipcMain.on(IPC.chromeDetachTab, (_event, tabId: string, screenPoint: ScreenPoint) => {
    windowManager.detachTabToNewWindow(tabId, screenPoint)
  })

  ipcMain.handle(IPC.chromeGetTabs, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? windowManager.getTabsSnapshot(win.id) : { tabs: [], activeTabId: null }
  })

  ipcMain.on(IPC.chromeSetTabViewVisible, (event, visible: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) windowManager.setActiveTabViewVisible(win.id, visible)
  })

  ipcMain.on(IPC.tabReportTitle, (_event, tabId: string, title: string) => {
    windowManager.updateTabMeta(tabId, { title })
  })

  ipcMain.on(IPC.tabReportCwd, (_event, tabId: string, cwd: string) => {
    windowManager.updateTabMeta(tabId, { cwd })
    recentDirectories.record(cwd)
  })

  ipcMain.on(IPC.tabReportRunningClaude, (_event, tabId: string, running: boolean) => {
    windowManager.updateTabMeta(tabId, { runningClaude: running })
  })

  ipcMain.handle(IPC.recentGetDirectories, (_event, limit?: number) =>
    recentDirectories.list(limit)
  )

  ipcMain.handle(IPC.savedSaveSession, (_event, { cwd, title }: { cwd: string; title: string }) => {
    const sessionId = findLatestClaudeSessionId(expandHome(cwd))
    if (!sessionId) return null
    return savedSessions.add({ sessionId, title, cwd, savedAt: Date.now() })
  })

  ipcMain.handle(IPC.savedGetSessions, () => savedSessions.list())

  // Chromium doesn't reliably keep delivering DOM pointermove events to a
  // renderer once the cursor exits that window's own bounds (e.g. dragging a
  // tab upward, off the top of the window) — so a drag's dnd-kit-reported
  // delta can get "stuck" at the last position recorded before the cursor
  // left the window, even though the OS cursor kept moving. Querying the
  // true screen position directly sidesteps that entirely.
  ipcMain.handle(IPC.systemGetCursorPoint, () => screen.getCursorScreenPoint())
}
