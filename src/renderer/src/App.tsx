import { useEffect } from 'react'
import TabBar from './components/TabBar/TabBar'
import TerminalWorkspace from './components/Terminal/TerminalWorkspace'
import { useTabStore } from './state/store'

function App(): React.JSX.Element {
  useEffect(() => {
    const offNewTab = window.chraude.menu.onNewTab(() => useTabStore.getState().addTab())
    const offClose = window.chraude.menu.onClose(() => useTabStore.getState().closeActivePane())
    const offSelectTab = window.chraude.menu.onSelectTab((index) =>
      useTabStore.getState().selectTabByIndex(index)
    )
    const offSplitRight = window.chraude.menu.onSplitRight(() =>
      useTabStore.getState().splitActivePane('row')
    )
    const offSplitDown = window.chraude.menu.onSplitDown(() =>
      useTabStore.getState().splitActivePane('column')
    )
    return () => {
      offNewTab()
      offClose()
      offSelectTab()
      offSplitRight()
      offSplitDown()
    }
  }, [])

  return (
    <>
      <TabBar />
      <TerminalWorkspace />
    </>
  )
}

export default App
