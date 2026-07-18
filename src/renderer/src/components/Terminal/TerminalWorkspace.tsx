import { useTabStore } from '../../state/store'
import PaneGrid from './PaneGrid'

export default function TerminalWorkspace(): React.JSX.Element {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)

  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      {tabs.map((tab) => {
        const visible = tab.id === activeTabId
        return (
          <div
            key={tab.id}
            style={{ position: 'absolute', inset: 0, display: visible ? 'flex' : 'none' }}
          >
            <PaneGrid
              tabId={tab.id}
              root={tab.root}
              activePaneId={tab.activePaneId}
              visible={visible}
            />
          </div>
        )
      })}
    </div>
  )
}
