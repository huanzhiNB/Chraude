import { Menu, type MenuItemConstructorOptions, app, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipcChannels'
import type { WindowManager } from '../windows/WindowManager'

function sendToFocusedChrome(channel: string, ...args: unknown[]): void {
  BrowserWindow.getFocusedWindow()?.webContents.send(channel, ...args)
}

// Split-tree state (and thus Close/Split-Right/Split-Down) lives in the
// focused chrome window's *active tab* WebContentsView, not the chrome
// window's own webContents — the chrome window only ever renders the tab
// strip + address bar.
function sendToFocusedTab(windowManager: WindowManager, channel: string, ...args: unknown[]): void {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) return
  const view = windowManager.getActiveTabView(win.id)
  view?.webContents.send(channel, ...args)
}

export function buildApplicationMenu(windowManager: WindowManager): Menu {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'Shell',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => sendToFocusedChrome(IPC.menuNewTab)
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          click: () => sendToFocusedTab(windowManager, IPC.menuClose)
        },
        { type: 'separator' },
        {
          label: 'Split Right',
          accelerator: 'CmdOrCtrl+D',
          click: () => sendToFocusedTab(windowManager, IPC.menuSplitRight)
        },
        {
          label: 'Split Down',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => sendToFocusedTab(windowManager, IPC.menuSplitDown)
        },
        { type: 'separator' },
        ...Array.from({ length: 9 }, (_, i) => ({
          label: `Select Tab ${i + 1}`,
          accelerator: `CmdOrCtrl+${i + 1}`,
          click: () => sendToFocusedChrome(IPC.menuSelectTab, i)
        }))
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [{ role: 'togglefullscreen' }, { role: 'toggleDevTools' }]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ role: 'front' as const }] : [])
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
  return menu
}
