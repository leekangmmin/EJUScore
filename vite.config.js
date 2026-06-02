// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Vite Config — Optimized for Production
// Features: Code Splitting, Chunk Optimization, Electron/PWA dual-mode
// ═══════════════════════════════════════════════════════════════════
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  base: mode === 'electron' ? './' : '/EJUScore/',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core — always loaded, small
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          // Recharts + d3 — heavy chart library, lazy loaded
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3') || id.includes('node_modules/victory')) {
            return 'vendor-recharts';
          }
          // Tesseract.js — OCR, only when user uploads images
          if (id.includes('node_modules/tesseract.js')) {
            return 'vendor-tesseract';
          }
          // Framer Motion — animations
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-framer';
          }
          // Hugging Face Transformers — AI model, large
          if (id.includes('node_modules/@huggingface/transformers') || id.includes('node_modules/onnxruntime')) {
            return 'vendor-transformers';
          }
          // PDFium — PDF processing
          if (id.includes('node_modules/@hyzyla/pdfium') || id.includes('node_modules/pdfjs')) {
            return 'vendor-pdf';
          }
          // KaTeX — math rendering (lazy)
          if (id.includes('node_modules/katex')) {
            return 'vendor-katex';
          }
        },
      },
    },
  },
}))
