// @ts-nocheck
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl my-4 border border-red-200">
          <h2 className="text-xl font-bold mb-2">エラーが発生しました</h2>
          <p className="font-mono text-xs text-left bg-white p-4 rounded overflow-auto break-all">{this.state.error?.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
