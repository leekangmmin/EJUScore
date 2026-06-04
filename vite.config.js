// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Vite Config — Optimized for Production
// Features: Code Splitting, Chunk Optimization, Electron/PWA dual-mode
//
// ╠═ DATA SOURCE CANONICALIZATION ═══════════════════════════════╣
// ║ Canonical source: scripts/eju-parser/out/parsed_questions.json
// ║   → served at runtime as public/dataset/canonical/parsed_questions.json
// ║
// ║ DEPRECATED sources (build-time import error):                ║
// ║   - dataset/comprehensive/**/*.json                          ║
// ║   - dataset/mathematics/**/*.json                            ║
// ║   - dataset/gold_standard/**                                 ║
// ║   - dataset_consolidated.json                                ║
// ║   - master_dataset.json                                      ║
// ║                                                              ║
// ║ ALLOWED (analysis outputs, not primary question corpus):     ║
// ║   - dataset/canonical/**                                     ║
// ║   - dataset/trend-analysis/**                                ║
// ║   - dataset/prediction/**                                    ║
// ║   - dataset/difficulty/**                                    ║
// ║   - dataset/knowledge-graph/**                               ║
// ║   - dataset/insights/**                                      ║
// ║   - dataset/topic-frequency/**                               ║
// ║   - dataset/training/**                                      ║
// ║   - dataset/reports/**                                       ║
// ║   - study_plan.json, weakness_profile.json                   ║
// ╚══════════════════════════════════════════════════════════════╝
// ═══════════════════════════════════════════════════════════════════
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ── Deprecated dataset path patterns (build-time error) ─────────────
const DEPRECATED_SOURCE_PATTERNS = [
  /dataset\/comprehensive\/(?!canonical)/,     // block comprehensive/* but allow comprehensive/canonical
  /dataset\/mathematics\//,                     // block all mathematics paths
  /dataset\/gold_standard\//,                   // block gold_standard
  /dataset_consolidated\.json$/,                // block any dataset_consolidated.json
  /master_dataset\.json$/,                      // block any master_dataset.json
];

function canonicalSourcePlugin() {
  return {
    name: 'canonical-source-enforcer',
    resolveId(source, importer) {
      if (!importer) return null;
      const normalizedPath = source.replace(/^\.\.\/|^\.\//g, '');
      for (const pattern of DEPRECATED_SOURCE_PATTERNS) {
        if (pattern.test(normalizedPath)) {
          const match = normalizedPath.match(pattern)?.[0] || normalizedPath;
          throw new Error(
            `[CANONICAL-SOURCE-ENFORCER] BLOCKED: "${source}" (imported by ${importer})\n` +
            `  ${'─'.repeat(60)}\n` +
            `  🚫 DEPRECATED SOURCE: ${match}\n` +
            `  ${'─'.repeat(60)}\n` +
            `  Canonical source: ./dataset/canonical/parsed_questions.json\n` +
            `  Use fetch('dataset/canonical/parsed_questions.json') instead.\n` +
            `  ${'─'.repeat(60)}`
          );
        }
      }
      return null;
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: mode === 'electron' ? './' : '/EJUScore/',
  plugins: [react(), canonicalSourcePlugin()],
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
          // PDFium / pdfjs intentionally NOT given a shared vendor chunk:
          // their only static importer is the lazy PhotoToQuestion route, so
          // letting them bundle into that route's chunk keeps the 5.4 MB out of
          // the eager entry graph (the shared __vitePreload helper was otherwise
          // co-located into a 'vendor-pdf' chunk and dragged into initial load).
          // KaTeX — math rendering (lazy)
          if (id.includes('node_modules/katex')) {
            return 'vendor-katex';
          }
        },
      },
    },
  },
}))
