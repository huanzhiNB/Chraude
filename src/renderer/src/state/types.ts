export interface PaneNode {
  type: 'leaf'
  id: string
}

export interface SplitNode {
  type: 'split'
  id: string
  direction: 'row' | 'column'
  sizes: number[]
  children: SplitTreeNode[]
}

export type SplitTreeNode = PaneNode | SplitNode

export interface TabState {
  id: string
  title: string
  root: SplitTreeNode
  activePaneId: string
}
