import { useRef } from 'react'
import { useTabStore } from '../../state/store'
import { computeLayout, findSplitNode, type ResizerSpec } from '../../state/paneTree'
import type { SplitTreeNode } from '../../state/types'
import ErrorBoundary from '../ErrorBoundary'
import TerminalPane from './TerminalPane'
import SplitResizer from './SplitResizer'
import RecentMenu from './RecentMenu'

// RecentDirectoryEntry paths are already `~`-abbreviated (see shell.ts's
// getShellCwd). Wrapping a leading `~` in double quotes would suppress the
// shell's tilde expansion, so it's kept outside the quoted segment — zsh
// (Chraude's login shell) still expands a `~` immediately followed by a
// quoted continuation, e.g. `~"/Huanzhi/msp-ios-sdk"`.
function quoteShellPath(path: string): string {
  const escaped = path.replace(/"/g, '\\"')
  return path.startsWith('~') ? `~"${escaped.slice(1)}"` : `"${escaped}"`
}

interface PaneGridProps {
  root: SplitTreeNode
  activePaneId: string
  visible: boolean
}

export default function PaneGrid({
  root,
  activePaneId,
  visible
}: PaneGridProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const setActivePane = useTabStore((s) => s.setActivePane)
  const resizeSplit = useTabStore((s) => s.resizeSplit)
  const paneStartedTyping = useTabStore((s) => s.paneStartedTyping)

  const { panes, resizers } = computeLayout(root)

  const runInPane = (paneId: string, command: string): void => {
    const sessionId = useTabStore.getState().paneSessionIds[paneId]
    if (sessionId) {
      window.chraude.pty.write(sessionId, `${command}\r`)
    }
    useTabStore.getState().markPaneStartedTyping(paneId)
  }

  const handleSelectRecentPath = (paneId: string, path: string): void => {
    runInPane(paneId, `cd ${quoteShellPath(path)}`)
  }

  const handleLaunchClaude = (paneId: string, path: string): void => {
    runInPane(paneId, `cd ${quoteShellPath(path)} && claude`)
  }

  const handleResizerMouseDown =
    (resizer: ResizerSpec) =>
    (e: React.MouseEvent): void => {
      e.preventDefault()
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const totalPx = resizer.direction === 'row' ? rect.width : rect.height
      const startPos = resizer.direction === 'row' ? e.clientX : e.clientY

      // Re-derive current sizes from the live store rather than a prop closure
      // so back-to-back drags always start from up-to-date numbers.
      const splitNode = findSplitNode(useTabStore.getState().root, resizer.splitId)
      if (!splitNode) return
      const startSizes = [...splitNode.sizes]
      const minSize = 0.1

      const handleMouseMove = (moveEvent: MouseEvent): void => {
        const currentPos = resizer.direction === 'row' ? moveEvent.clientX : moveEvent.clientY
        const deltaRootPct = ((currentPos - startPos) / totalPx) * 100
        const deltaLocalFraction = deltaRootPct / resizer.mainAxisExtentPct

        const newSizes = [...startSizes]
        let newA = startSizes[resizer.index] + deltaLocalFraction
        let newB = startSizes[resizer.index + 1] - deltaLocalFraction
        if (newA < minSize) {
          newB -= minSize - newA
          newA = minSize
        }
        if (newB < minSize) {
          newA -= minSize - newB
          newB = minSize
        }
        newSizes[resizer.index] = newA
        newSizes[resizer.index + 1] = newB
        resizeSplit(resizer.splitId, newSizes)
      }
      const handleMouseUp = (): void => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0 }}>
      {[...panes.entries()].map(([paneId, rect]) => (
        <div
          key={paneId}
          onMouseDown={() => setActivePane(paneId)}
          style={{
            position: 'absolute',
            boxSizing: 'border-box',
            top: `${rect.top}%`,
            left: `${rect.left}%`,
            width: `${rect.width}%`,
            height: `${rect.height}%`,
            display: 'flex',
            border: paneId === activePaneId ? '1px solid #4a90d9' : '1px solid transparent'
          }}
        >
          <ErrorBoundary>
            <TerminalPane paneId={paneId} visible={visible} focused={paneId === activePaneId} />
          </ErrorBoundary>
          {!paneStartedTyping[paneId] && (
            <RecentMenu
              onSelectPath={(path) => handleSelectRecentPath(paneId, path)}
              onLaunchClaude={(path) => handleLaunchClaude(paneId, path)}
            />
          )}
        </div>
      ))}
      {resizers.map((resizer) => (
        <SplitResizer
          key={resizer.id}
          resizer={resizer}
          onMouseDown={handleResizerMouseDown(resizer)}
        />
      ))}
    </div>
  )
}
