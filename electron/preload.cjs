// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  minimize:     () => ipcRenderer.send('win-minimize'),
  maximize:     () => ipcRenderer.send('win-maximize'),
  close:        () => ipcRenderer.send('win-close'),
  isMaximized:  () => ipcRenderer.invoke('win-is-maximized'),
  onMaximizeChange: (cb) => {
    ipcRenderer.on('win-maximized',   () => cb(true));
    ipcRenderer.on('win-unmaximized', () => cb(false));
  },
  ai: {
    load:     ()         => ipcRenderer.invoke('ai:load'),
    generate: (messages) => ipcRenderer.invoke('ai:generate', messages),
    isLoaded: ()         => ipcRenderer.invoke('ai:isLoaded'),
    onProgress: (cb)     => ipcRenderer.on('ai:progress', (_, data) => cb(data)),
    onToken:    (cb)     => ipcRenderer.on('ai:token', (_, text) => cb(text)),
    cleanup:    ()       => {
      ipcRenderer.removeAllListeners('ai:progress');
      ipcRenderer.removeAllListeners('ai:token');
    },
  },
});
