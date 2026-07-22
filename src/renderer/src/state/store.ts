import { create } from 'zustand'
import type { SplitTreeNode } from './types'
import {
  createPaneNode,
  findFirstLeafId,
  removePaneNode,
  splitPaneNode,
  updateSplitSizes
} from './paneTree'

// A tab-content WebContentsView only ever hosts one tab, so unlike the old
// single-renderer design this store has no outer `tabs` array — just this
// view's own split tree. Tab-level concerns (add/close/switch/reorder tabs)
// live in main's WindowManager + the chrome window's separate chromeStore.
export type CloseActivePaneResult = 'closed-pane' | 'close-tab'

interface TabContentStore {
  root: SplitTreeNode
  activePaneId: string
  // Foreground-process-derived titles/cwds, keyed by paneId — a tab's
  // effective title/cwd is whichever pane is currently active, so switching
  // focus between panes naturally changes what gets reported up to chrome.
  paneTitles: Record<string, string>
  paneCwds: Record<string, string>
  // Whether the pane's foreground process is currently `claude` — drives the
  // "Save" button in the address bar (see TerminalPane's title poll).
  paneRunningClaude: Record<string, boolean>
  // sessionId isn't otherwise exposed outside TerminalPane's own closure —
  // the Recent-directories overlay needs it to write a `cd` command into the
  // right pane's pty from outside that component.
  paneSessionIds: Record<string, string>
  // Whether the user has typed anything into this pane yet — drives the
  // Recent-directories overlay shown on a freshly created pane; false until
  // the first keystroke (or a Recent entry is clicked, which counts as one).
  paneStartedTyping: Record<string, boolean>
  setActivePane: (paneId: string) => void
  splitActivePane: (direction: 'row' | 'column') => void
  // 'close-tab' means the pane closed was this tab's only one — the caller
  // is responsible for telling main to close the tab itself.
  closeActivePane: () => CloseActivePaneResult
  resizeSplit: (splitId: string, sizes: number[]) => void
  setPaneTitle: (paneId: string, title: string) => void
  setPaneCwd: (paneId: string, cwd: string) => void
  setPaneRunningClaude: (paneId: string, running: boolean) => void
  setPaneSessionId: (paneId: string, sessionId: string) => void
  markPaneStartedTyping: (paneId: string) => void
}

const initialPane = createPaneNode()

export const useTabStore = create<TabContentStore>((set, get) => ({
  root: initialPane,
  activePaneId: initialPane.id,
  paneTitles: {},
  paneCwds: {},
  paneRunningClaude: {},
  paneSessionIds: {},
  paneStartedTyping: {},

  setActivePane: (paneId) => set({ activePaneId: paneId }),

  splitActivePane: (direction) => {
    const { root, activePaneId } = get()
    const { tree, newPaneId } = splitPaneNode(root, activePaneId, direction)
    set({ root: tree, activePaneId: newPaneId })
  },

  closeActivePane: () => {
    const { root, activePaneId } = get()
    if (root.type === 'leaf') {
      return 'close-tab'
    }

    const newRoot = removePaneNode(root, activePaneId)
    if (!newRoot) {
      return 'close-tab'
    }

    set({ root: newRoot, activePaneId: findFirstLeafId(newRoot) })
    return 'closed-pane'
  },

  resizeSplit: (splitId, sizes) => {
    set((s) => ({ root: updateSplitSizes(s.root, splitId, sizes) }))
  },

  setPaneTitle: (paneId, title) => {
    set((s) => ({ paneTitles: { ...s.paneTitles, [paneId]: title } }))
  },

  setPaneCwd: (paneId, cwd) => {
    set((s) => ({ paneCwds: { ...s.paneCwds, [paneId]: cwd } }))
  },

  setPaneRunningClaude: (paneId, running) => {
    set((s) => ({ paneRunningClaude: { ...s.paneRunningClaude, [paneId]: running } }))
  },

  setPaneSessionId: (paneId, sessionId) => {
    set((s) => ({ paneSessionIds: { ...s.paneSessionIds, [paneId]: sessionId } }))
  },

  markPaneStartedTyping: (paneId) => {
    // Skip the update once already true so this can be called on every
    // keystroke without triggering a re-render each time.
    set((s) =>
      s.paneStartedTyping[paneId]
        ? s
        : { paneStartedTyping: { ...s.paneStartedTyping, [paneId]: true } }
    )
  }
}))
