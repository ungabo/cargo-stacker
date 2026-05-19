const { app, BrowserWindow, shell } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
};

let staticServer = null;

function writeLog(message, error) {
  const detail = error?.stack || error?.message || '';
  const line = `[${new Date().toISOString()}] ${message}${detail ? `\n${detail}` : ''}\n`;

  try {
    const logDir = app.isReady() ? app.getPath('userData') : app.getPath('temp');
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'cargo-stacker-electron.log'), line);
  } catch {
    // Logging must never be the reason the app cannot launch.
  }
}

function getAppRoot() {
  if (!app.isPackaged) {
    return path.join(__dirname, '..');
  }

  const asarRoot = path.join(process.resourcesPath, 'app.asar');
  if (fs.existsSync(asarRoot)) {
    return asarRoot;
  }

  return path.join(process.resourcesPath, 'app');
}

function getDistPath() {
  return path.join(getAppRoot(), 'dist');
}

function resolveStaticPath(requestUrl) {
  const distPath = getDistPath();
  const url = new URL(requestUrl, 'http://localhost');
  const decodedPath = decodeURIComponent(url.pathname);
  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const filePath = path.normalize(path.join(distPath, relativePath));
  const safeRoot = distPath.endsWith(path.sep) ? distPath : `${distPath}${path.sep}`;

  if (!filePath.toLowerCase().startsWith(safeRoot.toLowerCase())) {
    return null;
  }

  return filePath;
}

function startStaticServer() {
  const server = http.createServer((request, response) => {
    const filePath = resolveStaticPath(request.url || '/');

    if (!filePath) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        writeLog(`Static asset missing: ${filePath}`, error);
        response.writeHead(404);
        response.end('Not found');
        return;
      }

      const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(data);
    });
  });

  server.on('clientError', (error, socket) => {
    writeLog('Static server client error', error);
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

function getWindowIconPath() {
  const candidatePaths = [
    path.join(__dirname, '..', 'build', 'icon.png'),
    path.join(process.resourcesPath || '', 'icon.png'),
  ];

  return candidatePaths.find((candidatePath) => candidatePath && fs.existsSync(candidatePath));
}

async function createWindow() {
  const { server, url } = await startStaticServer();
  staticServer = server;
  const icon = getWindowIconPath();

  const windowOptions = {
    width: 540,
    height: 960,
    minWidth: 360,
    minHeight: 640,
    backgroundColor: '#0c6ba8',
    title: 'Cargo Stacker',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  };

  if (icon) {
    windowOptions.icon = icon;
  }

  const window = new BrowserWindow(windowOptions);

  window.once('ready-to-show', () => {
    window.show();
  });

  window.on('closed', () => {
    server.close(() => {
      if (staticServer === server) {
        staticServer = null;
      }
    });
  });

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    writeLog(`Window failed to load ${validatedURL}: ${errorCode} ${errorDescription}`);
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    writeLog(`Renderer process gone: ${details.reason} (${details.exitCode})`);
  });

  window.webContents.on('unresponsive', () => {
    writeLog('Window became unresponsive');
  });

  window.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, targetUrl) => {
    if (!targetUrl.startsWith(url)) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  });

  await window.loadURL(url);
  writeLog(`Window loaded ${url}`);
}

process.on('uncaughtException', (error) => {
  writeLog('Uncaught exception', error);
});

process.on('unhandledRejection', (error) => {
  writeLog('Unhandled rejection', error);
});

app.whenReady()
  .then(createWindow)
  .catch((error) => {
    writeLog('Failed to create window', error);
    app.quit();
  });

app.on('window-all-closed', () => {
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((error) => {
      writeLog('Failed to activate window', error);
    });
  }
});
