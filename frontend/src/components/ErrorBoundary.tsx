import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  message:  string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  reset = () => {
    this.setState({ hasError: false, message: '' })
    this.props.onReset?.()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-6 px-8 text-center">
        <div className="text-4xl">⚠️</div>
        <p className="text-white font-bold text-lg">Algo salió mal</p>
        <p className="text-gray text-sm">{this.state.message}</p>
        <button
          onClick={this.reset}
          className="bg-uno-red text-white font-bold px-6 py-3 rounded-xl"
        >
          Volver al inicio
        </button>
      </div>
    )
  }
}
