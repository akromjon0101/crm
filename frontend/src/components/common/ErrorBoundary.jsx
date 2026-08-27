import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { fallback } = this.props;
    if (fallback) return fallback(this.state.error, this.handleReset);

    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1">Something went wrong</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 max-w-xs">
          {this.state.error?.message || 'An unexpected error occurred in this section.'}
        </p>
        <button
          onClick={this.handleReset}
          className="btn-secondary btn-sm"
        >
          Try again
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
