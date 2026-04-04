'use strict';

const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const fs = require('fs');

const BACKEND_PORT = 8080;
const FRONTEND_PORT = 3000;
const IS_DEV = process.env.ELECTRON_DEV === 'true';

let mainWindow = null;
let splashWindow = null;
let backendProcess = null;
let frontendServer = null;

// ── Paths ─────────────────────────────────────────────────────────────────
const getJarPath = () => app.isPackaged
  ? path.join(process.resourcesPath, 'app.jar')
  : path.join(__dirname, '../resources/app.jar');

const getDistPath = () => app.isPackaged
  ? path.join(process.resourcesPath, 'dist')
  : path.join(__dirname, '../dist');

// ── Local HTTP server (serves React build at localhost:3000) ──────────────
function startFrontendServer() {
  const dist = getDistPath();
  const MIME = {
    '.html':  'text/html; charset=utf-8',
    '.js':    'application/javascript; charset=utf-8',
    '.css':   'text/css; charset=utf-8',
    '.png':   'image/png',
    '.jpg':   'image/jpeg',
    '.jpeg':  'image/jpeg',
    '.svg':   'image/svg+xml',
    '.ico':   'image/x-icon',
    '.json':  'application/json',
    '.woff':  'font/woff',
    '.woff2': 'font/woff2',
    '.ttf':   'font/ttf',
    '.pdf':   'application/pdf',
  };

  frontendServer = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';

    let filePath = path.join(dist, urlPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(dist, 'index.html'); // SPA fallback
    }

    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');

    fs.createReadStream(filePath)
      .on('error', () => { res.writeHead(404); res.end('Not found'); })
      .pipe(res);
  });

  frontendServer.listen(FRONTEND_PORT, '127.0.0.1', () => {
    console.log(`[Frontend] Serving at http://localhost:${FRONTEND_PORT}`);
  });
}

// ── Spring Boot backend ───────────────────────────────────────────────────
function startBackend() {
  return new Promise((resolve, reject) => {
    const jar = getJarPath();

    if (!fs.existsSync(jar)) {
      return reject(new Error(
        `Backend not found at:\n${jar}\n\nPlease reinstall the application.`
      ));
    }

    backendProcess = spawn('java', ['-jar', jar, `--server.port=${BACKEND_PORT}`], {
      windowsHide: true,
    });

    backendProcess.stdout.on('data', d => process.stdout.write('[Backend] ' + d));
    backendProcess.stderr.on('data', d => process.stderr.write('[Backend] ' + d));

    backendProcess.on('error', err => {
      if (err.code === 'ENOENT') {
        reject(new Error(
          'Java is not installed or not found in PATH.\n\nPlease install Java 17+ from https://adoptium.net and restart the application.'
        ));
      } else {
        reject(new Error('Failed to start backend: ' + err.message));
      }
    });

    pollBackend(resolve, reject, 0);
  });
}

function pollBackend(resolve, reject, attempt) {
  if (attempt >= 90) {
    return reject(new Error('Backend took too long to start.\nPlease restart the application.'));
  }

  const socket = new net.Socket();
  socket.setTimeout(1000);

  const retry = () => {
    socket.destroy();
    setTimeout(() => pollBackend(resolve, reject, attempt + 1), 1000);
  };

  socket.connect(BACKEND_PORT, '127.0.0.1', () => {
    socket.destroy();
    console.log('[Backend] Ready on port', BACKEND_PORT);
    setTimeout(resolve, 2500); // extra buffer for Spring Boot full init
  });

  socket.on('error', retry);
  socket.on('timeout', retry);
}

// ── Splash screen ─────────────────────────────────────────────────────────
function createSplash() {
  // Embed icon as base64 so it works inside a data: URL
  let logoHtml = '<div class="box">DMA</div>';
  try {
    const iconPath = path.join(getDistPath(), 'icon.ico');
    const iconData = fs.readFileSync(iconPath);
    const b64 = iconData.toString('base64');
    logoHtml = `<img src="data:image/x-icon;base64,${b64}" class="logo" />`;
  } catch (_) { /* fall back to text box */ }

  splashWindow = new BrowserWindow({
    width: 480,
    height: 300,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    backgroundColor: '#1e40af',
    webPreferences: { contextIsolation: true },
  });

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html><html><head><meta charset="utf-8"><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{
        background:linear-gradient(135deg,#1e3a8a,#1e40af);
        display:flex;flex-direction:column;align-items:center;
        justify-content:center;height:100vh;
        font-family:system-ui,-apple-system,sans-serif;color:#fff;user-select:none
      }
      .logo{width:160px;height:auto;object-fit:contain;margin-bottom:20px;}
      .box{
        width:72px;height:72px;background:rgba(255,255,255,.15);
        border:2px solid rgba(255,255,255,.25);border-radius:18px;
        display:flex;align-items:center;justify-content:center;
        font-size:18px;font-weight:800;letter-spacing:1px;margin-bottom:20px
      }
      h1{font-size:22px;font-weight:700;margin-bottom:6px}
      p{font-size:13px;color:rgba(255,255,255,.6);margin-bottom:32px}
      .track{width:240px;height:4px;background:rgba(255,255,255,.2);border-radius:2px;overflow:hidden}
      .bar{height:100%;background:#fff;border-radius:2px;animation:fill 60s cubic-bezier(.4,0,.2,1) forwards}
      @keyframes fill{from{width:0}to{width:90%}}
    </style></head>
    <body>
      ${logoHtml}
      <h1>DMA Payslip System</h1>
      <p>Starting up, please wait…</p>
      <div class="track"><div class="bar"></div></div>
    </body></html>
  `)}`);
}

// ── Main window ───────────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: 'DMA Payslip System',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const url = IS_DEV
    ? 'http://localhost:5173'
    : `http://localhost:${FRONTEND_PORT}`;

  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    mainWindow.show();
    mainWindow.focus();
  });

  // Open external links in the default browser, not inside the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ── Google OAuth IPC ──────────────────────────────────────────────────────
// Opens a popup BrowserWindow for Google sign-in.
// When Supabase redirects back to localhost:3000, we intercept it,
// close the popup, and navigate the main window to the callback URL
// so the Supabase JS client can process the token automatically.
ipcMain.handle('oauth:start', (_, oauthUrl) => {
  return new Promise((resolve, reject) => {
    const authWin = new BrowserWindow({
      width: 520,
      height: 680,
      title: 'Sign in with Google',
      parent: mainWindow,
      modal: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });

    authWin.loadURL(oauthUrl);

    const handleRedirect = (url) => {
      if (!url.startsWith(`http://localhost:${FRONTEND_PORT}`)) return false;
      if (!authWin.isDestroyed()) authWin.close();
      mainWindow.loadURL(url); // Supabase client processes the token on load
      resolve(url);
      return true;
    };

    authWin.webContents.on('will-navigate', (e, url) => {
      if (handleRedirect(url)) e.preventDefault();
    });
    authWin.webContents.on('will-redirect', (e, url) => {
      if (handleRedirect(url)) e.preventDefault();
    });
    authWin.webContents.on('did-navigate', (_, url) => handleRedirect(url));

    authWin.on('closed', () => reject(new Error('Sign-in window was closed.')));
  });
});

// ── Lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  createSplash();
  try {
    if (!IS_DEV) {
      startFrontendServer();
      await startBackend();
    }
    createMainWindow();
  } catch (err) {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    dialog.showErrorBox('Startup Error', err.message);
    app.quit();
  }
});

function cleanup() {
  if (frontendServer) { frontendServer.close(); frontendServer = null; }
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

app.on('before-quit', cleanup);
app.on('window-all-closed', () => {
  cleanup();
  if (process.platform !== 'darwin') app.quit();
});
