import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotateRight, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh w-full flex items-center justify-center bg-[#f6f8fc] dark:bg-[#070709] text-zinc-900 dark:text-zinc-100 p-6 relative overflow-hidden">
          <div className="fixed -top-32 -left-32 w-[550px] h-[550px] rounded-full bg-rose-600/10 blur-[130px] pointer-events-none" />
          <div className="max-w-md w-full liquid-glass-card rounded-3xl p-8 text-center shadow-2xl space-y-5 z-10 animate-pop-in">
            <div className="w-16 h-16 bg-rose-500/15 text-rose-500 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto text-2xl border border-rose-500/20">
              <FontAwesomeIcon icon={faTriangleExclamation} />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Something went wrong</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                An unexpected error occurred. Click below to recover and refresh your dashboard.
              </p>
            </div>

            {this.state.error && (
              <div className="text-xs bg-zinc-100 dark:bg-black/50 text-rose-600 dark:text-rose-300 p-3 rounded-xl font-mono overflow-auto max-h-24 text-left border border-zinc-200 dark:border-white/10">
                {this.state.error.toString()}
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-semibold rounded-2xl shadow-lg transition-all touch-feedback flex items-center justify-center gap-2 cursor-pointer"
            >
              <FontAwesomeIcon icon={faRotateRight} />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
