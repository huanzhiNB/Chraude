import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

// A bug in one pane's xterm.js/addon code shouldn't take down every other
// open tab and pane along with it — isolate each pane's render tree.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 16,
            color: '#d4d4d4',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 12
          }}
        >
          This terminal pane crashed: {this.state.error.message}
        </div>
      )
    }
    return this.props.children
  }
}
