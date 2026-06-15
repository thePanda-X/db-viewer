import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleClearAndReload = () => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-background p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold tracking-tight">
              Something went wrong
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              The app encountered an error while rendering. This can happen
              after adding new features if saved state is incompatible.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
            <button
              onClick={this.handleClearAndReload}
              className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear saved state & reload
            </button>
          </div>
          {this.state.error && (
            <details className="mt-2 max-w-lg">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Error details
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
