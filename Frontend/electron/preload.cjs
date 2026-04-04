'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe API to the renderer (React app)
contextBridge.exposeInMainWorld('electronAPI', {
  // Triggers the Google OAuth popup window
  startOAuth: (url) => ipcRenderer.invoke('oauth:start', url),
});
