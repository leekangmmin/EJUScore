// ═══════════════════════════════════════════════════════════════════
// AdminApp — self-contained admin SPA mounted under #/admin/*.
//
// Uses HashRouter so deep links work on GitHub Pages (no SPA fallback
// needed) and Electron file:// alike. Entirely scoped under `.admin-scope`
// (see AdminLayout) so the existing app's styling is never touched.
// ═══════════════════════════════════════════════════════════════════
import { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import './admin.css';
import AdminLayout from './components/AdminLayout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Search = lazy(() => import('./pages/Search'));
const Uploads = lazy(() => import('./pages/Uploads'));
const OcrReview = lazy(() => import('./pages/OcrReview'));
const QuestionReview = lazy(() => import('./pages/QuestionReview'));
const Vector = lazy(() => import('./pages/Vector'));
const Datasets = lazy(() => import('./pages/Datasets'));

function Fallback() {
  return (
    <div className="admin-scope flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      불러오는 중…
    </div>
  );
}

export default function AdminApp() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Suspense fallback={<Fallback />}><Dashboard /></Suspense>} />
          <Route path="search" element={<Suspense fallback={<Fallback />}><Search /></Suspense>} />
          <Route path="uploads" element={<Suspense fallback={<Fallback />}><Uploads /></Suspense>} />
          <Route path="ocr-review" element={<Suspense fallback={<Fallback />}><OcrReview /></Suspense>} />
          <Route path="question-review" element={<Suspense fallback={<Fallback />}><QuestionReview /></Suspense>} />
          <Route path="vector" element={<Suspense fallback={<Fallback />}><Vector /></Suspense>} />
          <Route path="datasets" element={<Suspense fallback={<Fallback />}><Datasets /></Suspense>} />
        </Route>
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </HashRouter>
  );
}
