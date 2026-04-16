import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="h-screen flex items-center justify-center p-6 bg-bg">
        <div className="panel p-6 max-w-lg space-y-3">
          <h1 className="text-lg font-bold text-accent-red">Error en la aplicación</h1>
          <p className="text-sm text-white/70 font-mono">{this.state.error.message}</p>
          <div className="flex gap-2 pt-2">
            <button onClick={this.reset}
              className="px-4 py-2 border border-accent-blue text-accent-blue rounded hover:bg-accent-blue/10 text-xs font-mono">
              Reintentar
            </button>
            <button onClick={() => window.location.reload()}
              className="px-4 py-2 bg-accent-green text-bg font-bold rounded hover:brightness-110 text-xs">
              Recargar página
            </button>
          </div>
        </div>
      </div>
    );
  }
}
