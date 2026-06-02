// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Electron Preload — Secure Bridge between Main & Renderer
// Security: contextIsolation:true, no nodeIntegration, no executeJavaScript
// Migration via IPC instead of executeJavaScript
// ═══════════════════════════════════════════════════════════════════
const { contextBridge, ipcRenderer } = require('electron');

// ── Secure Migration Handler ────────────────────────────
// Replaces the previous executeJavaScript approach with IPC
ipcRenderer.on('migrate-data', (event, data) => {
  try {
    if (data.eju_exam_data && !localStorage.getItem('eju_exam_data')) {
      localStorage.setItem('eju_exam_data', JSON.stringify(data.eju_exam_data));
    }
    if (data.eju_settings && !localStorage.getItem('eju_settings')) {
      localStorage.setItem('eju_settings', JSON.stringify(data.eju_settings));
    }
    window.location.reload();
  } catch (e) {
    console.error('[Migration] Failed:', e);
  }
});

// ── Exposed API ─────────────────────────────────────────
// Minimal, validated surface area for renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  minimize:     () => ipcRenderer.send('win-minimize'),
  maximize:     () => ipcRenderer.send('win-maximize'),
  close:        () => ipcRenderer.send('win-close'),
  isMaximized:  () => ipcRenderer.invoke('win-is-maximized'),
  onMaximizeChange: (cb) => {
    ipcRenderer.on('win-maximized',   () => cb(true));
    ipcRenderer.on('win-unmaximized', () => cb(false));
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('win-maximized', cb);
      ipcRenderer.removeListener('win-unmaximized', cb);
    };
  },
  ai: {
    load:     ()         => ipcRenderer.invoke('ai:load'),
    generate: (messages) => ipcRenderer.invoke('ai:generate', messages),
    isLoaded: ()         => ipcRenderer.invoke('ai:isLoaded'),
    onProgress: (cb)     => { ipcRenderer.on('ai:progress', (_, data) => cb(data)); },
    onToken:    (cb)     => { ipcRenderer.on('ai:token', (_, text) => cb(text)); },
    cleanup:    ()       => {
      ipcRenderer.removeAllListeners('ai:progress');
      ipcRenderer.removeAllListeners('ai:token');
    },
  },
});
