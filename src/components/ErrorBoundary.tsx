import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

// Catches render-time exceptions so one bad page can't blank the whole app.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surfaced in the browser console for diagnosis.
    console.error('Render error caught by ErrorBoundary:', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="p-2">
        <div className="card border-bad/50 bg-bad/10 p-5 max-w-2xl">
          <div className="text-bad font-semibold">
            Something went wrong on this page
          </div>
          <p className="text-sm text-muted mt-1">
            This page hit an error and stopped rendering. Your other pages still
            work — switch using the left nav, or reload. If it keeps happening,
            send me the message below.
          </p>
          <pre className="text-xs mt-3 whitespace-pre-wrap break-words text-muted bg-ink-900 rounded p-3 max-h-48 overflow-auto">
            {error.message}
          </pre>
          <div className="flex gap-2 mt-3">
            <button className="btn" onClick={this.reset}>
              Try again
            </button>
            <button className="btn" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      </div>
    )
  }
}
