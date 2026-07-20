import { create } from 'zustand'
import type { ChromeTabSummary } from '@shared/types'

interface ChromeStore {
  tabs: ChromeTabSummary[]
  activeTabId: string | null
  // Merges fresh title/cwd/add/remove data from main while preserving the
  // renderer's own local tab order — main doesn't track strip order, only
  // which tab is active, so a wholesale replace here would undo a user's
  // drag-reorder the next time a title/cwd poll tick pushes an update.
  mergeTabs: (incoming: ChromeTabSummary[], activeTabId: string | null) => void
  reorderTabs: (fromId: string, toId: string) => void
}

export const useChromeStore = create<ChromeStore>((set, get) => ({
  tabs: [],
  activeTabId: null,

  mergeTabs: (incoming, activeTabId) => {
    const { tabs } = get()
    const incomingById = new Map(incoming.map((t) => [t.id, t]))
    const merged = tabs.filter((t) => incomingById.has(t.id)).map((t) => incomingById.get(t.id)!)
    for (const t of incoming) {
      if (!merged.some((m) => m.id === t.id)) merged.push(t)
    }
    set({ tabs: merged, activeTabId })
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
  }
}))
