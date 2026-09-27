import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[MTA ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="error-boundary-fallback">
            <h3>Something went wrong in this panel.</h3>
            <pre>{this.state.error.message}</pre>
            <button onClick={() => this.setState({ error: null })}>Retry</button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
