import { useEffect, useRef, useState } from 'react'
import type { SavedSession } from '@shared/types'
import { quoteShellPath } from '@shared/shellQuoting'
import './SettingsMenu.css'

function ThreeDotsIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="3" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="8" cy="13" r="1.4" />
    </svg>
  )
}

function ChevronRightIcon(): React.JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <path d="M6 3.5 11 8l-5 4.5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronLeftIcon(): React.JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <path d="M10 3.5 5 8l5 4.5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function formatRelativeTime(atMs: number, nowMs: number): string {
  const diff = nowMs - atMs
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'just now'
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  return `${Math.floor(diff / day)}d ago`
}

type View = 'menu' | 'saved'

// The three-dot settings menu. Top level is a plain list of settings
// entries (just "Saved" for now, more to follow) — picking one drills into
// its own sub-view rather than dumping its content straight into the menu.
export default function SettingsMenu(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('menu')
  const [sessions, setSessions] = useState<SavedSession[]>([])
  // Captured once per open rather than read during render, since Date.now()
  // is an impure call React disallows in the render body.
  const [openedAt, setOpenedAt] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // The active tab's terminal content is a native view layered on top of
  // everything below the chrome header (see WindowManager.layoutActiveTab)
  // — CSS z-index can't put this dropdown above it since that's a
  // cross-view compositing boundary, not a same-document stacking one.
  // Detaching that view for as long as the menu is open is what makes it
  // actually visible/clickable instead of being painted over.
  useEffect(() => {
    window.chraude.chrome.setTabViewVisible(!open)
    return () => {
      if (open) window.chraude.chrome.setTabViewVisible(true)
    }
  }, [open])

  useEffect(() => {
    if (view !== 'saved') return
    window.chraude.saved.getSessions().then(setSessions)
  }, [view])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  const handleToggleOpen = (): void => {
    setOpenedAt(Date.now())
    setOpen((wasOpen) => {
      const nextOpen = !wasOpen
      if (nextOpen) setView('menu')
      return nextOpen
    })
  }

  const handleLaunch = (session: SavedSession): void => {
    setOpen(false)
    window.chraude.chrome.newTab(
      `cd ${quoteShellPath(session.cwd)} && claude --resume ${session.sessionId}`,
      session.title
    )
  }

  return (
    <div className="chraude-settings" ref={containerRef}>
      <button
        className="chraude-settings__trigger"
        onClick={handleToggleOpen}
        aria-label="Settings"
      >
        <ThreeDotsIcon />
      </button>
      {open && (
        <div className="chraude-settings__menu">
          {view === 'menu' && (
            <ul className="chraude-settings__list">
              <li>
                <button className="chraude-settings__menu-item" onClick={() => setView('saved')}>
                  <span>Saved</span>
                  <ChevronRightIcon />
                </button>
              </li>
            </ul>
          )}
          {view === 'saved' && (
            <>
              <button className="chraude-settings__subheader" onClick={() => setView('menu')}>
                <ChevronLeftIcon />
                <span>Saved</span>
              </button>
              {sessions.length === 0 ? (
                <div className="chraude-settings__empty">No saved sessions yet</div>
              ) : (
                <ul className="chraude-settings__list">
                  {sessions.map((session) => (
                    <li key={session.id}>
                      <button
                        className="chraude-settings__item"
                        onClick={() => handleLaunch(session)}
                      >
                        <span className="chraude-settings__item-title">{session.title}</span>
                        <span className="chraude-settings__item-meta">
                          {session.cwd} · {formatRelativeTime(session.savedAt, openedAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
