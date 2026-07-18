import { create } from 'zustand'
import type { TabState } from './types'
import {
  createPaneNode,
  findFirstLeafId,
  removePaneNode,
  splitPaneNode,
  updateSplitSizes
} from './paneTree'

function createTab(title = 'Terminal'): TabState {
  const pane = createPaneNode()
  return { id: crypto.randomUUID(), title, root: pane, activePaneId: pane.id }
}

interface TabStore {
  tabs: TabState[]
  activeTabId: string
  // Foreground-process-derived titles, keyed by paneId (not tabId): a tab's
  // displayed title is whichever pane in it is currently active, so
  // switching focus between panes naturally updates the tab title too.
  paneTitles: Record<string, string>
  addTab: () => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  selectTabByIndex: (index: number) => void
  reorderTabs: (fromId: string, toId: string) => void
  setActivePane: (tabId: string, paneId: string) => void
  splitActivePane: (direction: 'row' | 'column') => void
  closeActivePane: () => void
  resizeSplit: (tabId: string, splitId: string, sizes: number[]) => void
  setPaneTitle: (paneId: string, title: string) => void
}

const initialTab = createTab()

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,
  paneTitles: {},

  addTab: () => {
    const tab = createTab()
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId } = get()
    const index = tabs.findIndex((t) => t.id === tabId)
    if (index === -1) return

    // Chrome semantics: closing the last tab closes the window.
    if (tabs.length === 1) {
      window.close()
      return
    }

    const remaining = tabs.filter((t) => t.id !== tabId)
    const nextActiveId =
      activeTabId === tabId ? remaining[Math.min(index, remaining.length - 1)].id : activeTabId
    set({ tabs: remaining, activeTabId: nextActiveId })
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  selectTabByIndex: (index) => {
    const tab = get().tabs[index]
    if (tab) set({ activeTabId: tab.id })
  },

  reorderTabs: (fromId, toId) => {
    const { tabs } = get()
    const fromIndex = tabs.findIndex((t) => t.id === fromId)
    const toIndex = tabs.findIndex((t) => t.id === toId)
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return

    const reordered = [...tabs]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    set({ tabs: reordered })
  },

  setActivePane: (tabId, paneId) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, activePaneId: paneId } : t))
    }))
  },

  splitActivePane: (direction) => {
    const { tabs, activeTabId } = get()
    const index = tabs.findIndex((t) => t.id === activeTabId)
    if (index === -1) return
    const tab = tabs[index]
    const { tree, newPaneId } = splitPaneNode(tab.root, tab.activePaneId, direction)
    const updated = [...tabs]
    updated[index] = { ...tab, root: tree, activePaneId: newPaneId }
    set({ tabs: updated })
  },

  // iTerm2/tmux semantics: closes the focused pane; if it was the tab's only
  // pane, closes the tab (which itself closes the window if it's the last tab).
  closeActivePane: () => {
    const { tabs, activeTabId, closeTab } = get()
    const index = tabs.findIndex((t) => t.id === activeTabId)
    if (index === -1) return
    const tab = tabs[index]

    if (tab.root.type === 'leaf') {
      closeTab(tab.id)
      return
    }

    const newRoot = removePaneNode(tab.root, tab.activePaneId)
    if (!newRoot) {
      closeTab(tab.id)
      return
    }

    const updated = [...tabs]
    updated[index] = { ...tab, root: newRoot, activePaneId: findFirstLeafId(newRoot) }
    set({ tabs: updated })
  },

  resizeSplit: (tabId, splitId, sizes) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, root: updateSplitSizes(t.root, splitId, sizes) } : t
      )
    }))
  },

  setPaneTitle: (paneId, title) => {
    set((s) => ({ paneTitles: { ...s.paneTitles, [paneId]: title } }))
  }
}))
