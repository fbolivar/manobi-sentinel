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
        <div className="panel p-8 max-w-lg space-y-4 text-center">
          <div className="text-4xl">⚠</div>
          <h1 className="text-lg font-bold text-accent-red">Error en la aplicación</h1>
          <p className="text-sm text-txt-muted font-mono">{this.state.error.message}</p>
          <div className="flex gap-3 justify-center pt-2">
            <button onClick={this.reset} className="btn-outline text-sm">Reintentar</button>
            <button onClick={() => window.location.reload()} className="btn-primary text-sm">Recargar página</button>
          </div>
        </div>
      </div>
    );
  }
}
