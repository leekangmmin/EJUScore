import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Build artifacts + vendored/minified third-party (not our source)
  globalIgnores([
    'dist',
    'release',
    'coverage',
    'public/tesseract',
    'public/**/*.min.js',
    'public/**/*.worker.js',
    'public/pdf.worker*.js',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // Node runtime: Electron main/preload + build scripts
  {
    files: ['electron/**/*.{js,cjs}', 'scripts/**/*.{js,mjs}', '*.config.js', 'vite.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  // Service worker context
  {
    files: ['public/sw.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
  // Vitest globals + Tesseract CDN global
  {
    files: ['src/test/**', '**/*.test.{js,jsx}'],
    languageOptions: { globals: { ...globals.node, vi: 'readonly', describe: 'readonly', it: 'readonly', test: 'readonly', expect: 'readonly', beforeEach: 'readonly', afterEach: 'readonly', beforeAll: 'readonly', afterAll: 'readonly' } },
  },
  {
    files: ['src/ocr/**'],
    languageOptions: { globals: { Tesseract: 'readonly' } },
  },
])
