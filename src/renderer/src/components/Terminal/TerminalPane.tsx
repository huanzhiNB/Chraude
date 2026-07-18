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
}

export default function TerminalPane({
  paneId,
  visible,
  focused
}: TerminalPaneProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const fitAddonRef = useRef<FitAddon>(null)
  const termRef = useRef<Terminal>(null)
  const sessionIdRef = useRef<string>(null)

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

    let disposed = false
    let unsubData: (() => void) | undefined
    let unsubExit: (() => void) | undefined
    let unsubTitle: (() => void) | undefined
    let unsubCwd: (() => void) | undefined

    loadRendererAddon(term, () => disposed)

    window.chraude.pty.create({ cols: term.cols, rows: term.rows }).then(({ sessionId: id }) => {
      if (disposed) {
        window.chraude.pty.kill(id)
        return
      }
      sessionIdRef.current = id

      unsubData = window.chraude.pty.onData(({ sessionId: sid, chunk }) => {
        if (sid === id) term.write(chunk)
      })
      unsubExit = window.chraude.pty.onExit(({ sessionId: sid }) => {
        if (sid === id) term.write('\r\n[process exited]\r\n')
      })
      unsubTitle = window.chraude.pty.onTitle(({ sessionId: sid, title }) => {
        if (sid === id) useTabStore.getState().setPaneTitle(paneId, title)
      })
      unsubCwd = window.chraude.pty.onCwd(({ sessionId: sid, cwd }) => {
        if (sid === id) useTabStore.getState().setPaneCwd(paneId, cwd)
      })
    })

    const dataDisposable = term.onData((data) => {
      if (sessionIdRef.current) window.chraude.pty.write(sessionIdRef.current, data)
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
      unsubData?.()
      unsubExit?.()
      unsubTitle?.()
      unsubCwd?.()
      try {
        term.dispose()
      } finally {
        // Always kill the shell process even if an xterm addon throws during
        // its own teardown — a leaked pty session is worse than a swallowed
        // dispose error.
        if (sessionIdRef.current) window.chraude.pty.kill(sessionIdRef.current)
      }
    }
    // paneId is a stable identity for this component's entire mounted
    // lifetime (see the flat-list architecture note in paneTree.ts) — this
    // effect is intentionally mount-once and must not re-run if it changed.
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
