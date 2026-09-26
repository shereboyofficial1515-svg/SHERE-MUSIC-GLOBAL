import { Component } from 'react';

/** Last-resort boundary so a rendering bug never leaves users on a blank page. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[SHERE MUSIC] Unexpected error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunkFailed = /Loading chunk|dynamically imported module|Importing a module script failed/i.test(String(this.state.error?.message));
    return (
      <div className="fatal">
        <h1>Something went wrong</h1>
        <p>{chunkFailed ? 'A new version of SHERE MUSIC is available, or your connection dropped.' : 'An unexpected error occurred. Reloading usually fixes it.'}</p>
        <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </div>
    );
  }
}
