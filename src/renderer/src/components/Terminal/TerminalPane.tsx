import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useTabStore } from '../../state/store'
import { TERMINAL_THEME } from './theme'
import '@xterm/xterm/css/xterm.css'

// xterm-addon-webgl is deliberately not used: its dispose() reproducibly
// throws on this Electron/GPU combination (an internal null-reference deep in
// its own teardown, not something reachable from our code), which took down
// the entire renderer on every tab close. Canvas is still far faster than the
// plain DOM renderer and has none of this fragility.
function loadRendererAddon(term: Terminal, isDisposed: () => boolean): void {
  import('@xterm/addon-canvas').then(({ CanvasAddon }) => {
    if (isDisposed()) return
    term.loadAddon(new CanvasAddon())
  })
}

interface TerminalPaneProps {
  paneId: string
  // The pane's tab is the one currently shown (all panes in a split tab
  // share this — it's about the tab being switched to, not pane focus).
  visible: boolean
  // This specific pane is the focused one within its (possibly split) tab.
  focused: boolean
  // A command to run once as soon as this pane's pty session is ready (e.g.
  // resuming a saved Claude session) — see PaneGrid.tsx. Only meaningful at
  // mount time, same stable-for-the-pane's-lifetime category as paneId.
  initialCommand?: string
  // Shown immediately instead of the generic default while initialCommand's
  // own process is still starting up (e.g. a resumed session's saved
  // title) — see PaneGrid.tsx. Same mount-time-only category as above.
  initialTitle?: string
}

export default function TerminalPane({
  paneId,
  visible,
  focused,
  initialCommand,
  initialTitle
}: TerminalPaneProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const fitAddonRef = useRef<FitAddon>(null)
  const termRef = useRef<Terminal>(null)
  const sessionIdRef = useRef<string>(null)
  // The foreground-process-name poll (see PtyManager) fires every ~1.5s and
  // would otherwise stomp a custom title a program sets via an OSC escape
  // sequence (e.g. Claude Code setting the tab title to its conversation
  // summary) back to the generic process name almost immediately. Track
  // which process name was in effect when the last OSC title was set, and
  // keep that title as long as the same process is still in the foreground;
  // once the foreground process changes, fall back to its name again.
  const lastProcessNameRef = useRef<string>('')
  const oscTitleOwnerRef = useRef<string | null>(null)
  // Separately, a resumed Claude session's seeded initial title (below)
  // can't rely on that same string-matching trick: node-pty's foreground
  // process name is unreliable for Claude specifically — Claude Code
  // rewrites its own process title to a version string (e.g. "2.1.217")
  // rather than leaving it as "claude", which we can't predict in advance.
  // The accurate, ps-based running-Claude signal (see main/pty/shell.ts's
  // isClaudeForeground) is what actually gates that protection instead.
  const claudeForegroundRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: 13,
      cursorBlink: true,
      scrollback: 10000,
      theme: TERMINAL_THEME
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    term.open(container)
    fitAddon.fit()
    termRef.current = term
    fitAddonRef.current = fitAddon

    if (initialTitle) {
      // Seeded immediately (don't wait on the pty even existing yet) so the
      // tab strip shows the resumed conversation's real title from the very
      // first paint, protected from the process-name poll until the running-
      // Claude check (below) confirms Claude actually exited.
      useTabStore.getState().setPaneTitle(paneId, initialTitle)
      claudeForegroundRef.current = true
    }

    let disposed = false
    let unsubData: (() => void) | undefined
    let unsubExit: (() => void) | undefined
    let unsubTitle: (() => void) | undefined
    let unsubCwd: (() => void) | undefined
    let unsubRunningClaude: (() => void) | undefined

    loadRendererAddon(term, () => disposed)

    window.chraude.pty.create({ cols: term.cols, rows: term.rows }).then(({ sessionId: id }) => {
      if (disposed) {
        window.chraude.pty.kill(id)
        return
      }
      sessionIdRef.current = id
      useTabStore.getState().setPaneSessionId(paneId, id)
      if (initialCommand) {
        window.chraude.pty.write(id, `${initialCommand}\r`)
        useTabStore.getState().markPaneStartedTyping(paneId)
      }

      unsubData = window.chraude.pty.onData(({ sessionId: sid, chunk }) => {
        if (sid === id) term.write(chunk)
      })
      unsubExit = window.chraude.pty.onExit(({ sessionId: sid }) => {
        if (sid === id) term.write('\r\n[process exited]\r\n')
      })
      unsubTitle = window.chraude.pty.onTitle(({ sessionId: sid, title }) => {
        if (sid !== id) return
        lastProcessNameRef.current = title
        if (claudeForegroundRef.current) return
        if (oscTitleOwnerRef.current === title) return
        oscTitleOwnerRef.current = null
        useTabStore.getState().setPaneTitle(paneId, title)
      })
      unsubCwd = window.chraude.pty.onCwd(({ sessionId: sid, cwd }) => {
        if (sid === id) useTabStore.getState().setPaneCwd(paneId, cwd)
      })
      unsubRunningClaude = window.chraude.pty.onRunningClaude(({ sessionId: sid, running }) => {
        if (sid !== id) return
        claudeForegroundRef.current = running
        useTabStore.getState().setPaneRunningClaude(paneId, running)
      })
    })

    const dataDisposable = term.onData((data) => {
      if (sessionIdRef.current) window.chraude.pty.write(sessionIdRef.current, data)
      useTabStore.getState().markPaneStartedTyping(paneId)
    })

    // xterm.js parses OSC 0/2 title-setting escape sequences on its own —
    // this is how Claude Code sets the terminal title to the conversation
    // summary. Give it precedence over the generic process-name poll above.
    const titleChangeDisposable = term.onTitleChange((title) => {
      if (!title) return
      oscTitleOwnerRef.current = lastProcessNameRef.current
      useTabStore.getState().setPaneTitle(paneId, title)
    })

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      if (sessionIdRef.current)
        window.chraude.pty.resize(sessionIdRef.current, term.cols, term.rows)
    })
    resizeObserver.observe(container)

    return () => {
      disposed = true
      resizeObserver.disconnect()
      dataDisposable.dispose()
      titleChangeDisposable.dispose()
      unsubData?.()
      unsubExit?.()
      unsubTitle?.()
      unsubCwd?.()
      unsubRunningClaude?.()
      try {
        term.dispose()
      } finally {
        // Always kill the shell process even if an xterm addon throws during
        // its own teardown — a leaked pty session is worse than a swallowed
        // dispose error.
        if (sessionIdRef.current) window.chraude.pty.kill(sessionIdRef.current)
      }
    }
    // paneId, initialCommand, and initialTitle are all stable for this
    // component's entire mounted lifetime (see the flat-list architecture
    // note in paneTree.ts) — this effect is intentionally mount-once and
    // must not re-run if they changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tabs stay mounted in the background (display:none) so their shell keeps
  // running and scrollback isn't lost; a hidden container measures as 0x0,
  // so re-fit explicitly whenever this pane's tab becomes visible again.
  useEffect(() => {
    if (!visible) return
    fitAddonRef.current?.fit()
    const term = termRef.current
    const sessionId = sessionIdRef.current
    if (term && sessionId) window.chraude.pty.resize(sessionId, term.cols, term.rows)
  }, [visible])

  useEffect(() => {
    if (focused) termRef.current?.focus()
  }, [focused])

  return <div ref={containerRef} style={{ width: '100%', height: '100%', padding: '8px' }} />
}
