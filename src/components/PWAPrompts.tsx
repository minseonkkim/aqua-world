import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const INSTALL_DISMISSED_KEY = 'aw_install_dismissed_at';
const INSTALL_DISMISS_TTL = 1000 * 60 * 60 * 24 * 7; // 일주일 재노출 안 함

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = 'standalone' in window.navigator
    && (window.navigator as unknown as { standalone: boolean }).standalone === true;
  return mq || iosStandalone;
}

function recentlyDismissed() {
  try {
    const v = localStorage.getItem(INSTALL_DISMISSED_KEY);
    if (!v) return false;
    return Date.now() - Number(v) < INSTALL_DISMISS_TTL;
  } catch {
    return false;
  }
}

export default function PWAPrompts() {
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installVisible, setInstallVisible] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl) {
      // 서비스워커 등록 OK. 콘솔에는 남기지 않음.
      void swUrl;
    },
  });

  useEffect(() => {
    if (isStandalone()) return;
    if (recentlyDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
      setInstallVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS Safari: beforeinstallprompt 미지원 → 게임 진입 직후 한 번만 안내
    if (isIOS()) {
      const t = window.setTimeout(() => setInstallVisible(true), 12000);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  useEffect(() => {
    const onInstalled = () => {
      setInstallVisible(false);
      setInstallEvt(null);
    };
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  useEffect(() => {
    const onReopen = () => {
      if (isStandalone()) return;
      try { localStorage.removeItem(INSTALL_DISMISSED_KEY); } catch {}
      if (isIOS() && !installEvt) {
        setShowIOSGuide(true);
      } else {
        setInstallVisible(true);
      }
    };
    window.addEventListener('aquaworld:show-install', onReopen);
    return () => window.removeEventListener('aquaworld:show-install', onReopen);
  }, [installEvt]);

  const dismissInstall = () => {
    setInstallVisible(false);
    setShowIOSGuide(false);
    try { localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now())); } catch {}
  };

  const triggerInstall = async () => {
    if (installEvt) {
      await installEvt.prompt();
      const choice = await installEvt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallVisible(false);
        setInstallEvt(null);
      } else {
        dismissInstall();
      }
    } else if (isIOS()) {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      {needRefresh && (
        <div style={bannerStyle('top')}>
          <span style={{ fontSize: 14 }}>🌊 새 버전이 준비됐어요</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn"
              style={btnPrimary}
              onClick={() => updateServiceWorker(true)}
            >
              지금 적용
            </button>
            <button
              className="btn btn-ghost"
              style={btnGhost}
              onClick={() => setNeedRefresh(false)}
            >
              나중에
            </button>
          </div>
        </div>
      )}

      {installVisible && !showIOSGuide && (
        <div style={bannerStyle('bottom')}>
          <span style={{ fontSize: 14 }}>🐠 홈 화면에 추가하면 더 편해요</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" style={btnPrimary} onClick={triggerInstall}>
              {isIOS() ? '방법 보기' : '설치하기'}
            </button>
            <button className="btn btn-ghost" style={btnGhost} onClick={dismissInstall}>
              닫기
            </button>
          </div>
        </div>
      )}

      {showIOSGuide && (
        <div
          onClick={dismissInstall}
          style={{
            position: 'fixed', inset: 0, zIndex: 2100,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-surface)',
              borderRadius: 20,
              padding: '24px 22px',
              maxWidth: 320,
              width: '100%',
              border: '1px solid rgba(255,255,255,0.1)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 8 }}>📱</div>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>홈 화면에 추가</h2>
            <ol style={{
              textAlign: 'left',
              fontSize: 14,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
              paddingLeft: 18,
              marginBottom: 16,
            }}>
              <li>하단 <strong style={{ color: '#fff' }}>공유 버튼</strong> 누르기 <span style={{ opacity: 0.7 }}>(􀈂)</span></li>
              <li>“<strong style={{ color: '#fff' }}>홈 화면에 추가</strong>” 선택</li>
              <li>오른쪽 위 “추가”로 마무리</li>
            </ol>
            <button className="btn" style={{ width: '100%', background: 'var(--color-primary)' }} onClick={dismissInstall}>
              알겠어요
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function bannerStyle(position: 'top' | 'bottom'): React.CSSProperties {
  return {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    [position]: 16,
    width: 'calc(100% - 32px)',
    maxWidth: 448,
    background: 'rgba(30, 58, 95, 0.95)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
    zIndex: 1900,
  };
}

const btnPrimary: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 13,
  background: 'var(--color-primary)',
  color: '#fff',
  borderRadius: 8,
};

const btnGhost: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 13,
  color: 'var(--color-text-secondary)',
};
