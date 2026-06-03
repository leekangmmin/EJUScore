// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// useIsMobile — viewport-width hook (matchMedia, ≤ breakpoint)
// Returns true when the viewport is at or below `breakpoint` px.
// SSR/Electron-safe: guards window access, cleans up its listener.
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';

export default function useIsMobile(breakpoint = 768) {
  const query = `(max-width: ${breakpoint}px)`;

  const getMatch = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false;

  const [isMobile, setIsMobile] = useState(getMatch);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = (e) => setIsMobile(e.matches);
    // sync once in case the viewport changed between render and effect
    setIsMobile(mql.matches);
    // addEventListener is the modern API; addListener is the Safari < 14 fallback
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return isMobile;
}
