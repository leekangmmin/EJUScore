// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { app, BrowserWindow, shell } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, unlinkSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'EJU Score Tracker',
    icon: process.platform === 'win32'
      ? join(__dirname, '../public/icon.ico')
      : join(__dirname, '../public/icon-512.png'),
    backgroundColor: '#0a0a14',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  win.loadFile(join(__dirname, '../dist/index.html'));

  // 마이그레이션: WKWebView → Electron localStorage
  win.webContents.once('did-finish-load', () => {
    const migratePath = join(app.getPath('userData'), 'migrate.json');
    if (existsSync(migratePath)) {
      try {
        const { eju_exam_data, eju_settings } = JSON.parse(readFileSync(migratePath, 'utf8'));
        win.webContents.executeJavaScript(`
          if (!localStorage.getItem('eju_exam_data')) {
            localStorage.setItem('eju_exam_data', ${JSON.stringify(JSON.stringify(eju_exam_data))});
            localStorage.setItem('eju_settings', ${JSON.stringify(JSON.stringify(eju_settings))});
            location.reload();
          }
        `);
        unlinkSync(migratePath);
      } catch (_) {}
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
