// ═══════════════════════════════════════════════════════════════════
// Tailwind config — SCOPED TO /admin ONLY
// preflight (global reset) is DISABLED so the existing app (inline styles
// + index.css CSS variables) is left pixel-identical. Tailwind utilities
// are only generated for classes used under src/admin/**.
// Dark mode follows the app's existing `data-theme="dark"` on <html>.
// ═══════════════════════════════════════════════════════════════════
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  // Only scan admin sources → no utilities leak onto the existing app.
  content: ['./src/admin/**/*.{js,jsx}'],
  corePlugins: {
    preflight: false, // ← critical: do not inject a global reset
  },
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--admin-border))',
        input: 'hsl(var(--admin-input))',
        ring: 'hsl(var(--admin-ring))',
        background: 'hsl(var(--admin-background))',
        foreground: 'hsl(var(--admin-foreground))',
        primary: {
          DEFAULT: 'hsl(var(--admin-primary))',
          foreground: 'hsl(var(--admin-primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--admin-secondary))',
          foreground: 'hsl(var(--admin-secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--admin-destructive))',
          foreground: 'hsl(var(--admin-destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--admin-muted))',
          foreground: 'hsl(var(--admin-muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--admin-accent))',
          foreground: 'hsl(var(--admin-accent-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--admin-success))',
          foreground: 'hsl(var(--admin-success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--admin-warning))',
          foreground: 'hsl(var(--admin-warning-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--admin-card))',
          foreground: 'hsl(var(--admin-card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--admin-popover))',
          foreground: 'hsl(var(--admin-popover-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--admin-radius)',
        md: 'calc(var(--admin-radius) - 2px)',
        sm: 'calc(var(--admin-radius) - 4px)',
      },
      fontFamily: {
        sans: ['Pretendard', 'Pretendard Variable', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'admin-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'admin-in': 'admin-in 0.18s ease-out',
      },
    },
  },
  plugins: [],
};
