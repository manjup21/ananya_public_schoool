import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { isChunkLoadError, reloadOnceForStaleChunks } from '../utils/chunkLoadRecovery';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    if (isChunkLoadError(error)) {
      reloadOnceForStaleChunks();
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-6">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-6">
              We're sorry, an unexpected error occurred. Please try reloading the page.
              If the issue persists, contact our support team.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Go to Home
              </button>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <details className="mt-6 text-left rounded-lg border border-red-200 bg-red-50 p-4">
                <summary className="text-sm font-medium text-red-700 cursor-pointer">
                  Error details (dev only)
                </summary>
                <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap break-words overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
