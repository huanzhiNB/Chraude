import { useEffect } from 'react'
import TabBar from './components/TabBar/TabBar'
import AddressBar from './components/AddressBar/AddressBar'
import { useChromeStore } from './state/chromeStore'

// Renders only the tab strip + address bar — the "browser chrome" window.
// Each tab's actual terminal content lives in its own WebContentsView,
// managed by main's WindowManager, attached below this UI.
export default function ChromeApp(): React.JSX.Element {
  useEffect(() => {
    const offTabsChanged = window.chraude.chrome.onTabsChanged(({ tabs, activeTabId }) => {
      useChromeStore.getState().mergeTabs(tabs, activeTabId)
    })
    // The push above can race a freshly-created window's renderer still
    // loading (Electron drops a send() with nobody subscribed yet rather
    // than queuing it) — pull the current state once on mount so a new
    // window's tab strip is never left empty regardless of that timing.
    window.chraude.chrome.getTabs().then(({ tabs, activeTabId }) => {
      useChromeStore.getState().mergeTabs(tabs, activeTabId)
    })
    const offNewTab = window.chraude.menu.onNewTab(() => window.chraude.chrome.newTab())
    const offSelectTab = window.chraude.menu.onSelectTab((index) => {
      const tab = useChromeStore.getState().tabs[index]
      if (tab) window.chraude.chrome.activateTab(tab.id)
    })
    return () => {
      offTabsChanged()
      offNewTab()
      offSelectTab()
    }
  }, [])

  return (
    <>
      <TabBar />
      <AddressBar />
    </>
  )
}
