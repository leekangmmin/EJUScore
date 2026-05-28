// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { Worker } from 'worker_threads';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { app, BrowserWindow, shell, session, ipcMain } = require('electron');

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
      webSecurity: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    titleBarOverlay: false,
    // macOS: 사이드바 영역 vibrancy 효과 (frosted glass)
    ...(process.platform === 'darwin' ? { vibrancy: 'sidebar', visualEffectState: 'active' } : {}),
  });

  win.loadURL(pathToFileURL(path.join(__dirname, '../dist/index.html')).href);

  // 마이그레이션: WKWebView → Electron localStorage
  win.webContents.once('did-finish-load', async () => {
    const migratePath = path.join(app.getPath('userData'), 'migrate.json');
    if (!fs.existsSync(migratePath)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(migratePath, 'utf8'));
      const examJson = JSON.stringify(raw.eju_exam_data);
      const settingsJson = JSON.stringify(raw.eju_settings);
      await win.webContents.executeJavaScript(
        `(function(){
          if (!localStorage.getItem('eju_exam_data')) {
            localStorage.setItem('eju_exam_data', ${JSON.stringify(examJson)});
            localStorage.setItem('eju_settings', ${JSON.stringify(settingsJson)});
          }
        })()`
      );
      fs.unlinkSync(migratePath);
      win.reload();
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
  // 서비스 워커가 ASAR 파일 요청을 가로채는 문제 방지
  await session.defaultSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── AI Worker ────────────────────────────────────────────
let aiWorker = null;

function getAIWorker() {
  if (aiWorker) return aiWorker;
  const cacheDir = path.join(app.getPath('userData'), 'hf-cache');
  aiWorker = new Worker(path.join(__dirname, 'aiWorker.js'), { workerData: { cacheDir } });
  aiWorker.on('error', (err) => {
    console.error('[AI Worker]', err.message);
    aiWorker = null;
  });
  aiWorker.on('exit', () => { aiWorker = null; });
  return aiWorker;
}

ipcMain.handle('ai:load', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const worker = getAIWorker();
  return new Promise((resolve, reject) => {
    const onMsg = (msg) => {
      if (msg.type === 'progress') { win?.webContents.send('ai:progress', msg.data); }
      else if (msg.type === 'loaded') { worker.off('message', onMsg); resolve(); }
      else if (msg.type === 'error') { worker.off('message', onMsg); reject(new Error(msg.message)); }
    };
    worker.on('message', onMsg);
    worker.postMessage({ type: 'load' });
  });
});

ipcMain.handle('ai:generate', (event, messages) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const worker = getAIWorker();
  return new Promise((resolve, reject) => {
    const onMsg = (msg) => {
      if (msg.type === 'token') { win?.webContents.send('ai:token', msg.text); }
      else if (msg.type === 'done') { worker.off('message', onMsg); resolve(); }
      else if (msg.type === 'error') { worker.off('message', onMsg); reject(new Error(msg.message)); }
    };
    worker.on('message', onMsg);
    worker.postMessage({ type: 'generate', messages });
  });
});

ipcMain.handle('ai:isLoaded', () => aiWorker !== null);

// Windows titlebar IPC
ipcMain.on('win-minimize',    () => BrowserWindow.getFocusedWindow()?.minimize());
ipcMain.on('win-maximize',    () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on('win-close',       () => BrowserWindow.getFocusedWindow()?.close());
ipcMain.handle('win-is-maximized', () => BrowserWindow.getFocusedWindow()?.isMaximized() ?? false);
