/**
 * pdfWorker.js — pdfjs 워커 엔트리 (Vite ?worker 로 번들)
 * ⚠️ 폴리필을 가장 먼저 로드해야 함:
 *   pdfjs 워커 스레드에는 메인 스레드 폴리필이 적용되지 않으므로,
 *   워커 자체 글로벌 스코프에 Uint8Array.toHex 등을 주입한 뒤 pdf 워커를 실행한다.
 */
import '../utils/polyfills';
import 'pdfjs-dist/build/pdf.worker.min.mjs';
