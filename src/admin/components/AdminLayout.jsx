import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Upload, ScanText, ListChecks, Boxes, Database, Search,
  Menu, X, Moon, Sun, ArrowLeft, ShieldCheck,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Toaster } from '../ui/toaster';

const NAV = [
  { to: '/admin/dashboard', label: '대시보드', icon: LayoutDashboard, desc: '검수 현황' },
  { to: '/admin/search', label: '자연어 검색', icon: Search, desc: '종합·수학 검색' },
  { to: '/admin/uploads', label: '업로드', icon: Upload, desc: 'PDF·OCR 적재' },
  { to: '/admin/ocr-review', label: 'OCR 검수', icon: ScanText, desc: '인식결과 검수' },
  { to: '/admin/question-review', label: '문제 검수', icon: ListChecks, desc: '분리·정답·중복' },
  { to: '/admin/vector', label: '벡터', icon: Boxes, desc: '임베딩 재생성' },
  { to: '/admin/datasets', label: '데이터셋', icon: Database, desc: '학습셋 내보내기' },
];

function useDarkMode() {
  const [dark, setDark] = useState(
    () => (typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme') !== 'light'
      : true)
  );
  useEffect(() => {
    const theme = dark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    try {
      const s = JSON.parse(localStorage.getItem('eju_settings') || '{}');
      localStorage.setItem('eju_settings', JSON.stringify({ ...s, theme }));
    } catch { /* ignore */ }
  }, [dark]);
  return [dark, () => setDark((d) => !d)];
}

function NavItems({ onNavigate }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, desc }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )
          }
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span className="flex flex-col leading-tight">
            {label}
            <span className="text-[11px] font-normal text-muted-foreground/80">{desc}</span>
          </span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function AdminLayout() {
  const [dark, toggleDark] = useDarkMode();
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  const current = NAV.find((n) => location.pathname.startsWith(n.to));

  useEffect(() => { setDrawer(false); }, [location.pathname]);

  return (
    <div className="admin-scope min-h-screen bg-background text-foreground">
      {/* ── Desktop / iPad sidebar ─────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card px-4 py-5 md:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold">EJU Admin</div>
            <div className="text-[11px] text-muted-foreground">검수 콘솔</div>
          </div>
        </div>
        <NavItems />
        <div className="mt-auto flex flex-col gap-2 px-1 pt-4">
          <button
            onClick={toggleDark}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {dark ? '라이트 모드' : '다크 모드'}
          </button>
          <a
            href={import.meta.env.BASE_URL}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> 앱으로 돌아가기
          </a>
        </div>
      </aside>

      {/* ── Mobile top app bar ─────────────────────────────── */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur md:hidden">
        <button
          onClick={() => setDrawer(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-accent"
          aria-label="메뉴 열기"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="text-sm font-bold">{current?.label || 'EJU Admin'}</div>
        <button
          onClick={toggleDark}
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-accent"
          aria-label="테마 전환"
        >
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </header>

      {/* ── Mobile drawer ──────────────────────────────────── */}
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[82%] animate-admin-in border-r border-border bg-card px-4 py-5">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="text-sm font-bold">EJU Admin</div>
              </div>
              <button onClick={() => setDrawer(false)} className="rounded-lg p-1.5 hover:bg-accent">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavItems onNavigate={() => setDrawer(false)} />
            <a
              href={import.meta.env.BASE_URL}
              className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" /> 앱으로 돌아가기
            </a>
          </div>
        </div>
      )}

      {/* ── Main content ───────────────────────────────────── */}
      <main className="md:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
          <Outlet />
        </div>
      </main>

      <Toaster />
    </div>
  );
}
