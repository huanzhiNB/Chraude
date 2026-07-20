import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { BrowserWindow, WebContentsView, shell, type WebContents } from 'electron'
import { is } from '@electron-toolkit/utils'
import { IPC } from '@shared/ipcChannels'
import type { ChromeTabSummary, ChromeTabsChangedEvent, ScreenPoint } from '@shared/types'

// Tab strip (40px) + address bar (40px) — matches TabBar.css/AddressBar.css.
const CHROME_HEADER_HEIGHT = 80

interface TabRecord {
  id: string
  view: WebContentsView
  chromeWindowId: number
  title: string
  cwd: string
}

interface ChromeWindowRecord {
  window: BrowserWindow
  tabIds: string[]
  activeTabId: string | null
}

const preloadPath = join(__dirname, '../preload/index.js')
const indexHtmlPath = join(__dirname, '../renderer/index.html')

function loadRenderer(webContents: WebContents, params: Record<string, string>): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const qs = new URLSearchParams(params).toString()
    webContents.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/?${qs}`)
  } else {
    webContents.loadFile(indexHtmlPath, { query: params })
  }
}

export class WindowManager {
  private chromeWindows = new Map<number, ChromeWindowRecord>()
  private tabs = new Map<string, TabRecord>()

  // Called right before a tab's view is destroyed, so main/index.ts can kill
  // that view's owned pty sessions (see ptyHandlers.ts's owner map) — kept
  // as a callback rather than a direct PtyManager import to keep window
  // lifecycle and pty lifecycle as separate concerns.
  constructor(private onTabWillClose: (webContents: WebContents) => void) {}

  createChromeWindow(position?: ScreenPoint): BrowserWindow {
    const window = new BrowserWindow({
      width: 1100,
      height: 700,
      minWidth: 480,
      minHeight: 300,
      x: position?.x,
      y: position?.y,
      show: false,
      backgroundColor: '#1e1e1e',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 14, y: 14 },
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    this.chromeWindows.set(window.id, { window, tabIds: [], activeTabId: null })

    window.on('ready-to-show', () => window.show())
    window.on('resize', () => this.layoutActiveTab(window.id))
    window.on('closed', () => {
      const record = this.chromeWindows.get(window.id)
      if (record) {
        for (const tabId of [...record.tabIds]) this.closeTab(tabId)
      }
      this.chromeWindows.delete(window.id)
    })

    if (is.dev) {
      window.webContents.on('console-message', (event) => {
        console.log('[chrome]', event.level, event.message, event.lineNumber, event.sourceId)
      })
    }
    window.webContents.on('render-process-gone', (_event, details) => {
      console.error('[chrome] gone', details)
    })
    window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    loadRenderer(window.webContents, { mode: 'chrome' })

    return window
  }

  createTab(chromeWindowId: number): string | undefined {
    const chromeRecord = this.chromeWindows.get(chromeWindowId)
    if (!chromeRecord) return undefined

    const tabId = randomUUID()
    const view = new WebContentsView({
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    if (is.dev) {
      view.webContents.on('console-message', (event) => {
        console.log('[tab', tabId.slice(0, 8) + ']', event.level, event.message, event.lineNumber)
      })
    }
    view.webContents.on('render-process-gone', (_event, details) => {
      console.error('[tab', tabId.slice(0, 8) + '] gone', details)
    })
    view.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    loadRenderer(view.webContents, { mode: 'tab', tab: tabId })

    this.tabs.set(tabId, { id: tabId, view, chromeWindowId, title: 'Terminal', cwd: '~' })
    chromeRecord.tabIds.push(tabId)

    this.activateTab(chromeWindowId, tabId)
    this.broadcastTabs(chromeWindowId)
    return tabId
  }

  activateTab(chromeWindowId: number, tabId: string): void {
    const chromeRecord = this.chromeWindows.get(chromeWindowId)
    const tabRecord = this.tabs.get(tabId)
    if (!chromeRecord || !tabRecord || tabRecord.chromeWindowId !== chromeWindowId) return
    if (chromeRecord.activeTabId === tabId) return

    const previousId = chromeRecord.activeTabId
    if (previousId) {
      const previous = this.tabs.get(previousId)
      if (previous) chromeRecord.window.contentView.removeChildView(previous.view)
    }

    chromeRecord.activeTabId = tabId
    chromeRecord.window.contentView.addChildView(tabRecord.view)
    this.layoutActiveTab(chromeWindowId)
    tabRecord.view.webContents.focus()
    this.broadcastTabs(chromeWindowId)
  }

  closeTab(tabId: string): void {
    const tabRecord = this.tabs.get(tabId)
    if (!tabRecord) return
    const chromeRecord = this.chromeWindows.get(tabRecord.chromeWindowId)

    if (chromeRecord) {
      chromeRecord.tabIds = chromeRecord.tabIds.filter((id) => id !== tabId)
      if (chromeRecord.activeTabId === tabId) {
        chromeRecord.window.contentView.removeChildView(tabRecord.view)
        chromeRecord.activeTabId = null
      }
    }

    this.tabs.delete(tabId)
    this.onTabWillClose(tabRecord.view.webContents)
    if (!tabRecord.view.webContents.isDestroyed()) {
      tabRecord.view.webContents.close()
    }

    if (!chromeRecord) return

    if (chromeRecord.tabIds.length === 0) {
      // Chrome semantics: closing a window's last tab closes the window.
      chromeRecord.window.close()
    } else if (!chromeRecord.activeTabId) {
      this.activateTab(chromeRecord.window.id, chromeRecord.tabIds[chromeRecord.tabIds.length - 1])
    } else {
      this.broadcastTabs(chromeRecord.window.id)
    }
  }

  // The whole point of the reparent-based tear-off design: the tab's
  // WebContentsView is never destroyed or reloaded here, just detached from
  // one chrome window's contentView and attached to a brand new one — so its
  // live pty session(s), xterm scrollback, and all in-page JS state survive
  // completely untouched. PtyManager's owner map needs no changes either,
  // since the view's webContents identity never changes.
  detachTabToNewWindow(tabId: string, screenPoint: ScreenPoint): void {
    const tabRecord = this.tabs.get(tabId)
    if (!tabRecord) return
    const oldChromeRecord = this.chromeWindows.get(tabRecord.chromeWindowId)
    if (!oldChromeRecord) return

    // Tearing off a window's only tab would just leave an empty shell behind
    // — not a meaningful new window. The user can already reposition a
    // single-tab window by dragging its own title bar.
    if (oldChromeRecord.tabIds.length === 1) return

    oldChromeRecord.tabIds = oldChromeRecord.tabIds.filter((id) => id !== tabId)
    if (oldChromeRecord.activeTabId === tabId) {
      oldChromeRecord.window.contentView.removeChildView(tabRecord.view)
      oldChromeRecord.activeTabId = null
    }
    if (!oldChromeRecord.activeTabId) {
      this.activateTab(
        oldChromeRecord.window.id,
        oldChromeRecord.tabIds[oldChromeRecord.tabIds.length - 1]
      )
    } else {
      this.broadcastTabs(oldChromeRecord.window.id)
    }

    const newWindow = this.createChromeWindow({
      x: Math.round(screenPoint.x - 100),
      y: Math.round(screenPoint.y - 20)
    })
    const newChromeRecord = this.chromeWindows.get(newWindow.id)!
    tabRecord.chromeWindowId = newWindow.id
    newChromeRecord.tabIds.push(tabId)
    this.activateTab(newWindow.id, tabId)
  }

  updateTabMeta(tabId: string, meta: { title?: string; cwd?: string }): void {
    const tabRecord = this.tabs.get(tabId)
    if (!tabRecord) return
    if (meta.title !== undefined) tabRecord.title = meta.title
    if (meta.cwd !== undefined) tabRecord.cwd = meta.cwd
    this.broadcastTabs(tabRecord.chromeWindowId)
  }

  getActiveTabView(chromeWindowId: number): WebContentsView | undefined {
    const record = this.chromeWindows.get(chromeWindowId)
    if (!record?.activeTabId) return undefined
    return this.tabs.get(record.activeTabId)?.view
  }

  hasAnyWindows(): boolean {
    return this.chromeWindows.size > 0
  }

  // Pull-based counterpart to the chromeTabsChanged push: the chrome
  // renderer's initial push (fired the moment a tab is created/activated)
  // can easily lose the race against that renderer still loading and
  // subscribing — Electron drops a send() with nobody listening yet rather
  // than queuing it. The renderer calls this once on mount to get the
  // correct state regardless of that timing, then relies on the push for
  // live updates after that.
  getTabsSnapshot(chromeWindowId: number): ChromeTabsChangedEvent {
    const chromeRecord = this.chromeWindows.get(chromeWindowId)
    if (!chromeRecord) return { tabs: [], activeTabId: null }
    return this.buildTabsSnapshot(chromeRecord)
  }

  private layoutActiveTab(chromeWindowId: number): void {
    const chromeRecord = this.chromeWindows.get(chromeWindowId)
    if (!chromeRecord?.activeTabId) return
    const tabRecord = this.tabs.get(chromeRecord.activeTabId)
    if (!tabRecord) return
    const bounds = chromeRecord.window.getContentBounds()
    tabRecord.view.setBounds({
      x: 0,
      y: CHROME_HEADER_HEIGHT,
      width: bounds.width,
      height: Math.max(0, bounds.height - CHROME_HEADER_HEIGHT)
    })
  }

  private buildTabsSnapshot(chromeRecord: ChromeWindowRecord): ChromeTabsChangedEvent {
    const tabs: ChromeTabSummary[] = chromeRecord.tabIds.map((id) => {
      const t = this.tabs.get(id)!
      return { id: t.id, title: t.title, cwd: t.cwd }
    })
    return { tabs, activeTabId: chromeRecord.activeTabId }
  }

  private broadcastTabs(chromeWindowId: number): void {
    const chromeRecord = this.chromeWindows.get(chromeWindowId)
    if (!chromeRecord || chromeRecord.window.webContents.isDestroyed()) return
    chromeRecord.window.webContents.send(
      IPC.chromeTabsChanged,
      this.buildTabsSnapshot(chromeRecord)
    )
  }
}
