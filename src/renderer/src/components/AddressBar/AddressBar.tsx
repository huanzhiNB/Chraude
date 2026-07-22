import { useState } from 'react'
import { useChromeStore } from '../../state/chromeStore'
import SettingsMenu from './SettingsMenu'
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

function SaveIcon(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3.5 1.5a1 1 0 0 0-1 1v12l5.5-3 5.5 3v-12a1 1 0 0 0-1-1h-9Z" />
    </svg>
  )
}

type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

// A Chrome-omnibox-style pill showing the active pane's current directory
// and (when set) its title, kept live via the same foreground-process-poll
// pipeline as tab titles. A "Save" button appears whenever Claude is the
// active pane's foreground process, letting the user bookmark that
// conversation so it can be resumed later from the settings menu.
export default function AddressBar(): React.JSX.Element {
  const tabs = useChromeStore((s) => s.tabs)
  const activeTabId = useChromeStore((s) => s.activeTabId)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const activeTab = tabs.find((t) => t.id === activeTabId)
  const cwd = activeTab?.cwd || '~'
  const title = activeTab?.title

  const handleSave = async (): Promise<void> => {
    if (!activeTab || saveState === 'saving') return
    setSaveState('saving')
    const result = await window.chraude.saved.saveCurrentSession(activeTab.cwd, activeTab.title)
    setSaveState(result ? 'saved' : 'failed')
    setTimeout(() => setSaveState('idle'), 2000)
  }

  return (
    <div className="chraude-addressbar">
      <div className="chraude-addressbar__pill">
        <FolderIcon />
        <span
          className={`chraude-addressbar__path${title ? ' chraude-addressbar__path--compact' : ''}`}
        >
          {cwd}
        </span>
        {title && (
          <>
            <span className="chraude-addressbar__separator">—</span>
            <span className="chraude-addressbar__title">{title}</span>
          </>
        )}
        {activeTab?.runningClaude && (
          <button
            className="chraude-addressbar__save-btn"
            onClick={handleSave}
            disabled={saveState === 'saving'}
          >
            <SaveIcon />
            {saveState === 'saved' ? 'Saved' : saveState === 'failed' ? 'Failed' : 'Save'}
          </button>
        )}
      </div>
      <SettingsMenu />
    </div>
  )
}
