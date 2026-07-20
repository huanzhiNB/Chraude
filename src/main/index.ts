import { app } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerPtyHandlers } from './ipc/ptyHandlers'
import { registerWindowHandlers } from './ipc/windowHandlers'
import { fixPathEnv } from './pty/shell'
import { buildApplicationMenu } from './menu/applicationMenu'
import { WindowManager } from './windows/WindowManager'
import type { PtyManager } from './pty/PtyManager'

let ptyManager: PtyManager | undefined
let windowManager: WindowManager | undefined

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.chraude.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  fixPathEnv()

  const { manager, killAllForOwner } = registerPtyHandlers()
  ptyManager = manager

  windowManager = new WindowManager((webContents) => killAllForOwner(webContents))
  registerWindowHandlers(windowManager)
  buildApplicationMenu(windowManager)

  const chromeWindow = windowManager.createChromeWindow()
  windowManager.createTab(chromeWindow.id)

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the dock
    // icon is clicked and there are no other windows open.
    if (!windowManager!.hasAnyWindows()) {
      const win = windowManager!.createChromeWindow()
      windowManager!.createTab(win.id)
    }
  })
})

app.on('will-quit', () => {
  ptyManager?.killAll()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
