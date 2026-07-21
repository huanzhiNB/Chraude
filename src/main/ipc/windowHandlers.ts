import { ipcMain, screen, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipcChannels'
import type { ScreenPoint } from '@shared/types'
import type { WindowManager } from '../windows/WindowManager'
import type { RecentDirectoriesStore } from '../recent/RecentDirectoriesStore'

export function registerWindowHandlers(
  windowManager: WindowManager,
  recentDirectories: RecentDirectoriesStore
): void {
  ipcMain.on(IPC.chromeNewTab, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) windowManager.createTab(win.id)
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

  ipcMain.on(IPC.tabReportTitle, (_event, tabId: string, title: string) => {
    windowManager.updateTabMeta(tabId, { title })
  })

  ipcMain.on(IPC.tabReportCwd, (_event, tabId: string, cwd: string) => {
    windowManager.updateTabMeta(tabId, { cwd })
    recentDirectories.record(cwd)
  })

  ipcMain.handle(IPC.recentGetDirectories, (_event, limit?: number) =>
    recentDirectories.list(limit)
  )

  // Chromium doesn't reliably keep delivering DOM pointermove events to a
  // renderer once the cursor exits that window's own bounds (e.g. dragging a
  // tab upward, off the top of the window) — so a drag's dnd-kit-reported
  // delta can get "stuck" at the last position recorded before the cursor
  // left the window, even though the OS cursor kept moving. Querying the
  // true screen position directly sidesteps that entirely.
  ipcMain.handle(IPC.systemGetCursorPoint, () => screen.getCursorScreenPoint())
}
