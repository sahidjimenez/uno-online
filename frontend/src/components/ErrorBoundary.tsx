import { StatusScreen } from './StatusScreen'
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
      <StatusScreen title="La mesa tuvo un imprevisto" description="Vuelve al inicio para preparar otra partida.">
        <button onClick={this.reset} className="nexo-primary-button">Volver al inicio</button>
        <details className="status-details"><summary>Ver detalles</summary><p>{this.state.message}</p></details>
      </StatusScreen>
    )
  }
}
