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
        <div className="p-6 text-center bg-red-50 rounded-2xl my-4 mx-4 border border-red-200 space-y-4">
          <h2 className="text-lg font-black text-danger">表示に失敗しました</h2>
          <p className="text-sm font-bold text-ink-soft leading-relaxed">
            通信状況が不安定か、アプリが古い可能性があります。
            <br />
            下のボタンで最新版を読み込み直してください。
          </p>
          <button
            onClick={() => {
              // iPhoneのホーム画面アプリにはリロードボタンが無いため、
              // URLを変えてキャッシュを確実に外した再読み込みを用意する。
              try {
                const url = new URL(window.location.href);
                url.searchParams.set('v', String(Date.now()));
                window.location.replace(url.toString());
              } catch {
                window.location.reload();
              }
            }}
            className="min-h-[48px] px-6 rounded-full bg-qb-blue text-white font-bold shadow-md active:scale-95 transition-transform"
          >
            最新版を読み込む
          </button>
          <details className="text-left">
            <summary className="text-xs font-bold text-ink-soft cursor-pointer">技術情報</summary>
            <p className="font-mono text-xs break-all mt-2 bg-white p-3 rounded-xl border border-line">
              {this.state.error?.message}
            </p>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
