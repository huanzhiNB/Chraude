import { useEffect, useState } from 'react'
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
  // The tab's "effective" title/cwd/running-state is whichever pane is
  // currently focused — report it up to main whenever it changes, so the
  // chrome window's tab strip label and address bar (which don't have
  // direct access to this view's store) can stay in sync.
  const effectiveTitle = useTabStore((s) => s.paneTitles[s.activePaneId])
  const effectiveCwd = useTabStore((s) => s.paneCwds[s.activePaneId])
  const effectiveRunningClaude = useTabStore((s) => s.paneRunningClaude[s.activePaneId])
  // A command to run once in this tab's original pane, e.g. `claude
  // --resume <id>` when relaunching a saved session (see WindowManager's
  // createTab/AddressBar's SettingsMenu). Read once — root.id at this exact
  // moment is that original pane's id, before any splits create new ones.
  const [launchCommand] = useState(
    () => new URLSearchParams(window.location.search).get('launchCommand') ?? undefined
  )
  // Shown immediately for the original pane instead of the generic default
  // while the launch command above is still starting up (e.g. a resumed
  // Claude session's saved title, before its own title poll/OSC event
  // lands) — see WindowManager.createTab.
  const [launchTitle] = useState(
    () => new URLSearchParams(window.location.search).get('initialTitle') ?? undefined
  )
  const [launchPaneId] = useState(() => useTabStore.getState().root.id)

  useEffect(() => {
    if (effectiveTitle) window.chraude.tab.reportTitle(tabId, effectiveTitle)
  }, [tabId, effectiveTitle])

  useEffect(() => {
    if (effectiveCwd) window.chraude.tab.reportCwd(tabId, effectiveCwd)
  }, [tabId, effectiveCwd])

  useEffect(() => {
    window.chraude.tab.reportRunningClaude(tabId, effectiveRunningClaude ?? false)
  }, [tabId, effectiveRunningClaude])

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

  return (
    <PaneGrid
      root={root}
      activePaneId={activePaneId}
      visible
      launchCommand={launchCommand}
      launchTitle={launchTitle}
      launchPaneId={launchPaneId}
    />
  )
}
