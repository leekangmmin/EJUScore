// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { app, BrowserWindow, shell } = require('electron');

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
    backgroundColor: '#0a0a14',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  win.loadFile(path.join(__dirname, '../dist/index.html'));

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
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
