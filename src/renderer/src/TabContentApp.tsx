import { useEffect } from 'react'
import PaneGrid from './components/Terminal/PaneGrid'
import { useTabStore } from './state/store'

interface TabContentAppProps {
  tabId: string
}

// Renders one tab's split-pane/terminal tree — hosted in its own
// WebContentsView (see main/windows/WindowManager.ts), separate from the
// chrome window's tab strip/address bar.
export default function TabContentApp({ tabId }: TabContentAppProps): React.JSX.Element {
  const root = useTabStore((s) => s.root)
  const activePaneId = useTabStore((s) => s.activePaneId)
  // The tab's "effective" title/cwd is whichever pane is currently focused —
  // report it up to main whenever it changes, so the chrome window's tab
  // strip label and address bar (which don't have direct access to this
  // view's store) can stay in sync.
  const effectiveTitle = useTabStore((s) => s.paneTitles[s.activePaneId])
  const effectiveCwd = useTabStore((s) => s.paneCwds[s.activePaneId])

  useEffect(() => {
    if (effectiveTitle) window.chraude.tab.reportTitle(tabId, effectiveTitle)
  }, [tabId, effectiveTitle])

  useEffect(() => {
    if (effectiveCwd) window.chraude.tab.reportCwd(tabId, effectiveCwd)
  }, [tabId, effectiveCwd])

  useEffect(() => {
    const offClose = window.chraude.menu.onClose(() => {
      const result = useTabStore.getState().closeActivePane()
      if (result === 'close-tab') window.chraude.chrome.closeTab(tabId)
    })
    const offSplitRight = window.chraude.menu.onSplitRight(() =>
      useTabStore.getState().splitActivePane('row')
    )
    const offSplitDown = window.chraude.menu.onSplitDown(() =>
      useTabStore.getState().splitActivePane('column')
    )
    return () => {
      offClose()
      offSplitRight()
      offSplitDown()
    }
  }, [tabId])

  return <PaneGrid root={root} activePaneId={activePaneId} visible />
}
