import { Toaster as SonnerToaster, toast } from 'sonner';

/** App-themed sonner toaster. Follows the app's `data-theme`. */
function Toaster() {
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'dark';
  return (
    <SonnerToaster
      theme={isDark ? 'dark' : 'light'}
      position="top-center"
      richColors
      toastOptions={{
        style: { fontFamily: 'Pretendard, system-ui, sans-serif', borderRadius: '0.75rem' },
      }}
    />
  );
}

export { Toaster, toast };
