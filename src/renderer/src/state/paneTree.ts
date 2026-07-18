import type { PaneNode, SplitNode, SplitTreeNode } from './types'

export function createPaneNode(): PaneNode {
  return { type: 'leaf', id: crypto.randomUUID() }
}

export function findFirstLeafId(node: SplitTreeNode): string {
  return node.type === 'leaf' ? node.id : findFirstLeafId(node.children[0])
}

export function splitPaneNode(
  root: SplitTreeNode,
  targetPaneId: string,
  direction: 'row' | 'column'
): { tree: SplitTreeNode; newPaneId: string } {
  const newPane = createPaneNode()

  function recurse(node: SplitTreeNode): SplitTreeNode {
    if (node.type === 'leaf') {
      if (node.id !== targetPaneId) return node
      return {
        type: 'split',
        id: crypto.randomUUID(),
        direction,
        sizes: [0.5, 0.5],
        children: [node, newPane]
      }
    }
    return { ...node, children: node.children.map(recurse) }
  }

  return { tree: recurse(root), newPaneId: newPane.id }
}

// Returns null when the removed pane was the tree's only leaf (caller should
// close the whole tab in that case). A split left with a single remaining
// child collapses to just that child, matching iTerm2/tmux behavior.
export function removePaneNode(root: SplitTreeNode, targetPaneId: string): SplitTreeNode | null {
  if (root.type === 'leaf') {
    return root.id === targetPaneId ? null : root
  }

  const newChildren = root.children
    .map((child) => removePaneNode(child, targetPaneId))
    .filter((child): child is SplitTreeNode => child !== null)

  if (newChildren.length === 0) return null
  if (newChildren.length === 1) return newChildren[0]

  const changed = newChildren.length !== root.children.length
  return {
    ...root,
    children: newChildren,
    sizes: changed ? newChildren.map(() => 1 / newChildren.length) : root.sizes
  }
}

export function updateSplitSizes(
  root: SplitTreeNode,
  splitId: string,
  sizes: number[]
): SplitTreeNode {
  if (root.type === 'leaf') return root
  if (root.id === splitId) return { ...root, sizes }
  return {
    ...root,
    children: root.children.map((child) => updateSplitSizes(child, splitId, sizes))
  }
}

export function findSplitNode(root: SplitTreeNode, splitId: string): SplitNode | undefined {
  if (root.type === 'leaf') return undefined
  if (root.id === splitId) return root
  for (const child of root.children) {
    const found = findSplitNode(child, splitId)
    if (found) return found
  }
  return undefined
}

export interface PaneRect {
  top: number
  left: number
  width: number
  height: number
}

export interface ResizerSpec {
  id: string
  splitId: string
  index: number
  direction: 'row' | 'column'
  crossStart: number
  crossExtent: number
  centerPct: number
  // The split's own extent along its main axis, as a percentage of the whole
  // tab viewport — needed to convert a drag delta (in root-relative percent)
  // back into a local sizes[] fraction delta for that specific split.
  mainAxisExtentPct: number
}

// Panes are rendered as a flat, percentage-positioned list rather than
// nested per the tree shape — see the note on SplitLayout's removal: nesting
// components per tree shape meant every restructuring (split/merge) changed
// the JSX element type at some position, which forces React to unmount and
// remount the terminal underneath, killing and respawning the real shell
// process. Flat + absolutely-positioned means a pane's identity (and thus
// its mounted TerminalPane/pty) never changes as the tree is restructured
// around it — only the numbers describing where it sits on screen do.
export function computeLayout(root: SplitTreeNode): {
  panes: Map<string, PaneRect>
  resizers: ResizerSpec[]
} {
  const panes = new Map<string, PaneRect>()
  const resizers: ResizerSpec[] = []

  function recurse(node: SplitTreeNode, rect: PaneRect): void {
    if (node.type === 'leaf') {
      panes.set(node.id, rect)
      return
    }

    const total = node.sizes.reduce((a, b) => a + b, 0) || 1
    const mainAxisExtentPct = node.direction === 'row' ? rect.width : rect.height
    let offset = 0

    node.children.forEach((child, i) => {
      const fraction = node.sizes[i] / total
      const childRect: PaneRect =
        node.direction === 'row'
          ? {
              top: rect.top,
              height: rect.height,
              left: rect.left + offset * rect.width,
              width: fraction * rect.width
            }
          : {
              left: rect.left,
              width: rect.width,
              top: rect.top + offset * rect.height,
              height: fraction * rect.height
            }

      if (i > 0) {
        resizers.push({
          id: `${node.id}-resizer-${i}`,
          splitId: node.id,
          index: i - 1,
          direction: node.direction,
          crossStart: node.direction === 'row' ? rect.top : rect.left,
          crossExtent: node.direction === 'row' ? rect.height : rect.width,
          centerPct: node.direction === 'row' ? childRect.left : childRect.top,
          mainAxisExtentPct
        })
      }

      recurse(child, childRect)
      offset += fraction
    })
  }

  recurse(root, { top: 0, left: 0, width: 100, height: 100 })
  return { panes, resizers }
}
