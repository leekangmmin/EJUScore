// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useState, useEffect, useCallback } from 'react';
import { Smartphone, Monitor, Globe, X, Download, ExternalLink, CheckCircle2 } from 'lucide-react';

/* ── Platform detection ── */
function detectPlatform() {
  const ua = navigator.userAgent;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  if (isStandalone) return { id: 'standalone', label: '앱 실행 중', icon: CheckCircle2, alreadyInstalled: true };

  const isIOS = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
  const isAndroid = /android/i.test(ua);
  const isWindows = /windows/i.test(ua) && !isAndroid;
  const isMacOS = /macintosh|mac os x/i.test(ua) && !isIOS;

  if (isIOS) return { id: 'ios', label: 'iOS (iPhone/iPad)', icon: Smartphone, steps: [
    'Safari에서 이 페이지를 엽니다',
    '하단 공유 버튼 (사각형+↑)을 탭합니다',
    '스크롤하여 "홈 화면에 추가"를 선택합니다',
    '오른쪽 상단 "추가"를 탭합니다',
  ], alreadyInstalled: false };

  if (isAndroid) return { id: 'android', label: 'Android', icon: Smartphone, steps: [
    'Chrome 브라우저 우측 상단 ⋮ 메뉴를 엽니다',
    '"홈 화면에 추가" 또는 "앱 설치"를 선택합니다',
    '팝업에서 "설치" 버튼을 탭합니다',
    '홈 화면에 생성된 아이콘으로 실행합니다',
  ], alreadyInstalled: false };

  if (isWindows) return { id: 'windows', label: 'Windows (Edge/Chrome)', icon: Monitor, steps: [
    'Edge: 주소창 우측 ⋯ → "앱" → "이 사이트를 앱으로 설치"',
    'Chrome: 주소창 우측 ⋮ → "EJU Score Tracker 설치..."',
    '팝업에서 "설치" 버튼을 클릭합니다',
    '시작 메뉴/작업표시줄에 생성된 아이콘으로 실행합니다',
  ], alreadyInstalled: false };

  if (isMacOS) return { id: 'macos', label: 'macOS (Safari/Chrome)', icon: Globe, steps: [
    'Chrome: 주소창 우측 ⋮ → "EJU Score Tracker 설치..."',
    'Safari: 파일 → 홈 화면에 추가 (또는 Dock에 추가)',
    'Chrome: 설치 팝업에서 "설치" 버튼 클릭',
    '응용 프로그램 폴더/Launchpad에서 실행 가능',
  ], alreadyInstalled: false };

  return { id: 'other', label: '기타 브라우저', icon: Globe, steps: [
    '브라우저 메뉴에서 "홈 화면에 추가" 또는 "앱으로 설치"를 찾아보세요',
    'Chrome/Edge/Safari를 사용하면 더 원활한 설치가 가능합니다',
  ], alreadyInstalled: false };
}

/* ═══════════════════════════════════════════════════════════════════
   InstallGuide Component
   ═══════════════════════════════════════════════════════════════════ */

export default function InstallGuide({ onClose, onDontShowAgain }) {
  const [platform, setPlatform] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [stepComplete, setStepComplete] = useState({});

  useEffect(() => {
    setPlatform(detectPlatform());

    // ── beforeinstallprompt (Android/Chrome) ──
    const handlePrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);

    // ── 설치 완료 감지 ──
    const handleInstalled = () => {
      setInstalled(true);
      setStepComplete(prev => ({ ...prev, installDone: true }));
    };
    window.addEventListener('appinstalled', handleInstalled);

    // ── standalone 모드 변경 감지 ──
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e) => {
      if (e.matches) setPlatform(prev => prev?.id !== 'standalone' ? {
        id: 'standalone', label: '앱 실행 중', icon: CheckCircle2, alreadyInstalled: true, steps: []
      } : prev);
    };
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setInstalled(true);
      setStepComplete(prev => ({ ...prev, installDone: true }));
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const isStandalone = platform?.alreadyInstalled;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        width: 'min(440px, 92vw)', maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--card-bg)', border: '1px solid var(--bd0)',
        borderRadius: 24, padding: 28,
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Download size={20} color="#fff" strokeWidth={2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t0)', letterSpacing: '-0.02em' }}>
              {isStandalone ? '앱이 설치되었습니다' : 'EJU 스코어 앱으로 설치하기'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 4, lineHeight: 1.5 }}>
              {isStandalone
                ? '현재 독립 실행형 앱 모드로 실행 중입니다. 모든 기능을 이용할 수 있습니다.'
                : '웹앱(PWA)으로 설치하면 오프라인에서도 사용 가능하고, 더 빠르게 실행됩니다.'}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 10,
            border: '1px solid var(--bd1)', background: 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: 'var(--t3)',
          }}><X size={14} strokeWidth={2} /></button>
        </div>

        {/* ── Already installed ── */}
        {isStandalone ? (
          <div style={{
            padding: '16px 18px', borderRadius: 16,
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <CheckCircle2 size={24} color="#10b981" strokeWidth={2} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>설치 완료</div>
              <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>
                EJU Score Tracker가 {platform.label} 모드로 실행 중입니다.
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ── Platform badge ── */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 10,
              background: 'rgba(99,102,241,0.08)', color: '#6366f1',
              fontSize: 11.5, fontWeight: 600,
              alignSelf: 'flex-start',
            }}>
              {platform && <platform.icon size={14} strokeWidth={2} />}
              {platform?.label || '플랫폼 감지 중...'}
            </div>

            {/* ── Install button (Android/Chrome) ── */}
            {deferredPrompt && (
              <button onClick={handleInstall} className="btn-toss-bounce" style={{
                padding: '12px 20px', borderRadius: 14,
                border: 'none',
                background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
              }}>
                <Download size={16} strokeWidth={2.5} />
                앱 설치하기 (권장)
              </button>
            )}

            {/* ── Steps ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', letterSpacing: '-0.01em' }}>
                수동 설치 방법 ({platform?.label || '브라우저'}):
              </div>
              {platform?.steps.map((step, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  padding: '10px 12px', borderRadius: 12,
                  background: stepComplete[i] ? 'rgba(16,185,129,0.06)' : 'var(--bg2)',
                  border: `1px solid ${stepComplete[i] ? 'rgba(16,185,129,0.15)' : 'var(--bd0)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }} onClick={() => setStepComplete(prev => ({ ...prev, [i]: !prev[i] }))}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 8,
                    background: stepComplete[i] ? '#10b981' : 'rgba(99,102,241,0.1)',
                    color: stepComplete[i] ? '#fff' : '#6366f1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>
                    {stepComplete[i] ? <CheckCircle2 size={13} /> : i + 1}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.5 }}>
                    {step}
                  </div>
                </div>
              ))}
            </div>

            {/* ── iOS 특별 안내 ── */}
            {platform?.id === 'ios' && (
              <div style={{
                padding: '12px 14px', borderRadius: 14,
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.12)',
                fontSize: 11, color: 'var(--t2)', lineHeight: 1.6,
              }}>
                <strong style={{ color: '#f59e0b' }}>iOS 참고:</strong> Apple 정책상 PWA 설치는 Safari 브라우저를 통해서만 가능합니다.
                Chrome/다른 브라우저를 사용 중이라면 Safari로 페이지를 열어주세요.
              </div>
            )}
          </>
        )}

        {/* ── Footer ── */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {!isStandalone && (
            <button onClick={onDontShowAgain} style={{
              padding: '9px 14px', borderRadius: 12,
              border: '1px solid var(--bd1)', background: 'transparent',
              color: 'var(--t3)', cursor: 'pointer', fontSize: 11,
              fontFamily: 'inherit', fontWeight: 500,
            }}>
              다시 보지 않기
            </button>
          )}
          <button onClick={onClose} style={{
            marginLeft: 'auto', padding: '9px 18px', borderRadius: 12,
            border: 'none', background: 'rgba(99,102,241,0.08)',
            color: '#6366f1', cursor: 'pointer', fontSize: 12,
            fontFamily: 'inherit', fontWeight: 600,
          }}>
            {isStandalone ? '앱 시작하기' : '닫기'}
          </button>
        </div>
      </div>

      <style>{`
        .btn-toss-bounce { transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .btn-toss-bounce:hover { transform: scale(1.015); }
        .btn-toss-bounce:active { transform: scale(0.95); opacity: 0.85; }
      `}</style>
    </div>
  );
}
