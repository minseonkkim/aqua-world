import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

// Sentry는 lazy load — replayIntegration 제거(~100KB+ 절감), 첫 페인트 차단하지 않음.
// 초기화 전 발생한 에러는 native window.onerror 가 받아두므로 손실은 거의 없다.
let sentryReady: Promise<typeof import('@sentry/react')> | null = null;
function loadSentry() {
  if (!sentryReady) sentryReady = import('@sentry/react');
  return sentryReady;
}

if (import.meta.env.VITE_SENTRY_DSN) {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
    .requestIdleCallback;
  const idle = (cb: () => void) => (ric ? ric(cb) : setTimeout(cb, 300));
  idle(() => {
    void loadSentry().then((Sentry) => {
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: 0.1,
      });
    }).catch(() => {});
  });
}

// 루트 ErrorBoundary — Sentry.ErrorBoundary 의 의존성을 없애 첫 번들 분리.
// 렌더 크래시 시 fallback UI 노출 + Sentry 가 init 됐으면 캡처.
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    void loadSentry().then((S) => S.captureException(error)).catch(() => {});
  }
  render() {
    if (this.state.error) {
      return (
        <div
          className="app-shell"
          style={{ alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}
        >
          <div>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🌊</div>
            <div>
              문제가 발생했어요.<br />새로고침 해주세요.
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>,
);
