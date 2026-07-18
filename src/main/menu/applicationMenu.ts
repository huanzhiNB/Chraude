import { Menu, type MenuItemConstructorOptions, app, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipcChannels'

function sendToFocused(channel: string, ...args: unknown[]): void {
  BrowserWindow.getFocusedWindow()?.webContents.send(channel, ...args)
}

export function buildApplicationMenu(): Menu {
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
          click: () => sendToFocused(IPC.menuNewTab)
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          click: () => sendToFocused(IPC.menuClose)
        },
        { type: 'separator' },
        {
          label: 'Split Right',
          accelerator: 'CmdOrCtrl+D',
          click: () => sendToFocused(IPC.menuSplitRight)
        },
        {
          label: 'Split Down',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => sendToFocused(IPC.menuSplitDown)
        },
        { type: 'separator' },
        ...Array.from({ length: 9 }, (_, i) => ({
          label: `Select Tab ${i + 1}`,
          accelerator: `CmdOrCtrl+${i + 1}`,
          click: () => sendToFocused(IPC.menuSelectTab, i)
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
