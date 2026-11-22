import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { isChunkLoadError, reloadOnceForStaleChunks } from '../utils/chunkLoadRecovery';

export class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[PageError]', error, errorInfo);
    if (isChunkLoadError(error)) {
      reloadOnceForStaleChunks();
    }
  }

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isStaleChunk = isChunkLoadError(this.state.error);

      return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 mb-4">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            This page encountered an error
          </h2>
          <p className="text-sm text-gray-600 mb-5 max-w-sm">
            {isStaleChunk
              ? 'The app was updated. Reload to load the latest version.'
              : 'Something went wrong while loading this page. Try again or navigate to a different page. If the issue persists, contact support.'}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            {isStaleChunk ? 'Reload page' : 'Try Again'}
          </button>

          {import.meta.env.DEV && this.state.error && (
            <details className="mt-6 text-left rounded-lg border border-red-200 bg-red-50 p-3 max-w-lg w-full">
              <summary className="text-xs font-medium text-red-700 cursor-pointer">
                Error details (dev only)
              </summary>
              <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap break-words overflow-auto max-h-32">
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
