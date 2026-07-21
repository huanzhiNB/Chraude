import { useEffect, useState } from 'react'
import type { RecentDirectoryEntry } from '@shared/types'
import './RecentMenu.css'

const DEFAULT_LIMIT = 5
const EXPANDED_LIMIT = 50

interface RecentMenuProps {
  onSelectPath: (path: string) => void
  onLaunchClaude: (path: string) => void
}

// A "new tab page"-style overlay shown on a freshly created pane, listing
// recently cd'd-into directories (see main/recent/RecentDirectoriesStore.ts)
// so the user can jump straight back into a project. Sits visually on top of
// the terminal underneath but doesn't grab keyboard focus — typing anything
// still reaches the terminal and separately dismisses this (see PaneGrid).
export default function RecentMenu({
  onSelectPath,
  onLaunchClaude
}: RecentMenuProps): React.JSX.Element {
  const [entries, setEntries] = useState<RecentDirectoryEntry[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.chraude.recent
      .getDirectories(expanded ? EXPANDED_LIMIT : DEFAULT_LIMIT)
      .then((result) => {
        if (!cancelled) setEntries(result)
      })
    return () => {
      cancelled = true
    }
  }, [expanded])

  return (
    <div className="chraude-recent">
      <h2 className="chraude-recent__title">Recent</h2>
      {entries.length === 0 ? (
        <span className="chraude-recent__empty">No recent directories yet</span>
      ) : (
        <ul className="chraude-recent__list">
          {entries.map((entry) => (
            <li key={entry.path} className="chraude-recent__row">
              <button className="chraude-recent__item" onClick={() => onSelectPath(entry.path)}>
                <span className="chraude-recent__name">{entry.name}</span>
                <span className="chraude-recent__parent">{entry.parent}</span>
              </button>
              <button
                className="chraude-recent__claude-btn"
                onClick={() => onLaunchClaude(entry.path)}
              >
                Claude
              </button>
            </li>
          ))}
        </ul>
      )}
      {!expanded && entries.length >= DEFAULT_LIMIT && (
        <button className="chraude-recent__more" onClick={() => setExpanded(true)}>
          More...
        </button>
      )}
    </div>
  )
}
