import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerPtyHandlers } from './ipc/ptyHandlers'
import { fixPathEnv } from './pty/shell'
import { buildApplicationMenu } from './menu/applicationMenu'
import type { PtyManager } from './pty/PtyManager'

let ptyManager: PtyManager | undefined

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 480,
    minHeight: 300,
    show: false,
    backgroundColor: '#1e1e1e',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // window.close() (whether from the traffic light, Cmd+Q, or our own
  // "close last tab" logic) tears down the renderer immediately — React
  // never gets a chance to run its unmount cleanup, so pty sessions must be
  // killed from here instead, or the shell processes are orphaned forever.
  mainWindow.on('closed', () => {
    ptyManager?.killAll()
  })

  if (is.dev) {
    mainWindow.webContents.on('console-message', (event) => {
      console.log('[renderer]', event.level, event.message, event.lineNumber, event.sourceId)
    })
  }
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[renderer] gone', details)
  })
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[renderer] failed to load', code, desc)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.chraude.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  fixPathEnv()
  buildApplicationMenu()
  ptyManager = registerPtyHandlers(() => BrowserWindow.getAllWindows()[0]?.webContents)

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
