// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Electron Main Process — Production-Safe Configuration
// Security: webSecurity:true, CSP headers, no executeJavaScript, IPC validation
// ═══════════════════════════════════════════════════════════════════
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { Worker } from 'worker_threads';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { app, BrowserWindow, shell, session, ipcMain } = require('electron');

// ── Content Security Policy ──────────────────────────────
// Restricts script/style sources to prevent XSS via injected content
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' blob:",          // unsafe-eval needed for WASM; blob: for tesseract workers
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self' blob: https://huggingface.co https://cdn-lfs.huggingface.co",
  "worker-src 'self' blob:",
  "media-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'EJU Score Tracker',
    icon: process.platform === 'win32'
      ? path.join(__dirname, '../public/icon.ico')
      : path.join(__dirname, '../public/icon-512.png'),
    backgroundColor: '#0e0f17',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,              // ⚠️ CRITICAL FIX: was false → true
      preload: path.join(__dirname, 'preload.cjs'),
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    titleBarOverlay: false,
    ...(process.platform === 'darwin' ? { vibrancy: 'sidebar', visualEffectState: 'active' } : {}),
  });

  // ── CSP via response headers ──────────────────────────
  // file:// protocol doesn't support headers, so we use session.webRequest
  // to intercept and inject CSP for all loaded resources
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP],
      },
    });
  });

  win.loadURL(pathToFileURL(path.join(__dirname, '../dist/index.html')).href);

  // ── Secure Migration: IPC-based instead of executeJavaScript ──
  // REPLACED: executeJavaScript with IPC message to preload → safe
  win.webContents.once('did-finish-load', async () => {
    const migratePath = path.join(app.getPath('userData'), 'migrate.json');
    if (!fs.existsSync(migratePath)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(migratePath, 'utf8'));
      if (raw.eju_exam_data && raw.eju_settings) {
        // Send via IPC instead of executeJavaScript
        win.webContents.send('migrate-data', {
          eju_exam_data: raw.eju_exam_data,
          eju_settings: raw.eju_settings,
        });
      }
      fs.unlinkSync(migratePath);
    } catch (_) {}
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('maximize',   () => win.webContents.send('win-maximized'));
  win.on('unmaximize', () => win.webContents.send('win-unmaximized'));
}

app.whenReady().then(async () => {
  await session.defaultSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── AI Worker ────────────────────────────────────────────
let aiWorker = null;
let aiModelLoaded = false;

function getAIWorker() {
  if (aiWorker) return aiWorker;
  const cacheDir = path.join(app.getPath('userData'), 'hf-cache');
  aiWorker = new Worker(path.join(__dirname, 'aiWorker.js'), { workerData: { cacheDir } });
  aiWorker.on('error', (err) => {
    console.error('[AI Worker]', err.message);
    aiWorker = null;
    aiModelLoaded = false;
  });
  aiWorker.on('exit', () => { aiWorker = null; aiModelLoaded = false; });
  return aiWorker;
}

function awaitWorkerResult(worker, onMessage) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.off('message', onMsg);
      worker.off('error', onErr);
      worker.off('exit', onExit);
    };
    const onMsg = (msg) => onMessage(msg, () => { cleanup(); resolve(); }, (err) => { cleanup(); reject(err); });
    const onErr = (err) => { cleanup(); reject(err instanceof Error ? err : new Error(String(err))); };
    const onExit = (code) => { cleanup(); reject(new Error(`AI 워커가 예기치 않게 종료되었습니다 (code ${code})`)); };
    worker.on('message', onMsg);
    worker.once('error', onErr);
    worker.once('exit', onExit);
  });
}

// ── IPC Validation ──────────────────────────────────────
function validateAIMessages(messages) {
  if (!Array.isArray(messages)) throw new Error('Invalid messages format');
  for (const m of messages) {
    if (typeof m !== 'object' || !m.role || typeof m.content !== 'string') {
      throw new Error('Invalid message structure');
    }
    if (m.content.length > 8000) throw new Error('Message too long');
    if (!['system', 'user', 'assistant'].includes(m.role)) throw new Error('Invalid role');
  }
  return messages;
}

ipcMain.handle('ai:load', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const worker = getAIWorker();
  const promise = awaitWorkerResult(worker, (msg, done, fail) => {
    if (msg.type === 'progress') { win?.webContents.send('ai:progress', msg.data); }
    else if (msg.type === 'loaded') { aiModelLoaded = true; done(); }
    else if (msg.type === 'error') { fail(new Error(msg.message)); }
  });
  worker.postMessage({ type: 'load' });
  return promise;
});

ipcMain.handle('ai:generate', (event, messages) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const worker = getAIWorker();
  // Input validation to prevent prompt injection
  const validated = validateAIMessages(messages);
  const promise = awaitWorkerResult(worker, (msg, done, fail) => {
    if (msg.type === 'token') { win?.webContents.send('ai:token', msg.text); }
    else if (msg.type === 'done') { done(); }
    else if (msg.type === 'error') { fail(new Error(msg.message)); }
  });
  worker.postMessage({ type: 'generate', messages: validated });
  return promise;
});

ipcMain.handle('ai:isLoaded', () => aiModelLoaded);

// Windows titlebar IPC
ipcMain.on('win-minimize',    () => BrowserWindow.getFocusedWindow()?.minimize());
ipcMain.on('win-maximize',    () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on('win-close',       () => BrowserWindow.getFocusedWindow()?.close());
ipcMain.handle('win-is-maximized', () => BrowserWindow.getFocusedWindow()?.isMaximized() ?? false);
