import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('EventFlow caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetDemo = () => {
    try {
      localStorage.removeItem('eventflow_autosave');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 text-slate-100 p-6">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-2xl space-y-5 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">Ein Fehler ist aufgetreten</h2>
              <p className="text-sm text-slate-400">
                Die Anwendung konnte ein Element nicht wie erwartet darstellen.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-xs font-mono text-red-300 max-h-36 overflow-auto break-all">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Seite neu laden
              </button>
              <button
                onClick={this.handleResetDemo}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium text-sm transition-colors"
                title="Löscht den lokalen Zwischenspeicher und stellt das Startprojekt her"
              >
                <Trash2 className="w-4 h-4" />
                Demo wiederherstellen
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
