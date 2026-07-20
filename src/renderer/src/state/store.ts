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
  setActivePane: (paneId: string) => void
  splitActivePane: (direction: 'row' | 'column') => void
  // 'close-tab' means the pane closed was this tab's only one — the caller
  // is responsible for telling main to close the tab itself.
  closeActivePane: () => CloseActivePaneResult
  resizeSplit: (splitId: string, sizes: number[]) => void
  setPaneTitle: (paneId: string, title: string) => void
  setPaneCwd: (paneId: string, cwd: string) => void
}

const initialPane = createPaneNode()

export const useTabStore = create<TabContentStore>((set, get) => ({
  root: initialPane,
  activePaneId: initialPane.id,
  paneTitles: {},
  paneCwds: {},

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
  }
}))
