import { useTabStore } from '../../state/store'
import './AddressBar.css'

function FolderIcon(): React.JSX.Element {
  return (
    <svg
      className="chraude-addressbar__icon"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M1.5 3A1.5 1.5 0 0 1 3 1.5h3.379a1.5 1.5 0 0 1 1.06.44l1.122 1.12A1.5 1.5 0 0 0 9.62 3.5H13A1.5 1.5 0 0 1 14.5 5v7A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12V3Z" />
    </svg>
  )
}

// A Chrome-omnibox-style pill showing the active pane's current directory,
// kept live via the same foreground-process-poll pipeline as tab titles.
export default function AddressBar(): React.JSX.Element {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const paneCwds = useTabStore((s) => s.paneCwds)

  const activeTab = tabs.find((t) => t.id === activeTabId)
  const cwd = (activeTab && paneCwds[activeTab.activePaneId]) || '~'

  return (
    <div className="chraude-addressbar">
      <div className="chraude-addressbar__pill">
        <FolderIcon />
        <span className="chraude-addressbar__path">{cwd}</span>
      </div>
    </div>
  )
}
