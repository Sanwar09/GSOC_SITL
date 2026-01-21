const { app, BrowserWindow, screen, ipcMain, session } = require('electron');

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false
    }
  });

  // --- AUTOMATIC MOUSE MODE SWITCHER ---
  // This fixes the issue where Dashboard/Login buttons were unclickable
  const updateMouseMode = (url) => {
    // If we are on a menu page (Dashboard, Login, Register), make the window CLICKABLE
    if (url.includes('/dashboard') || url.includes('/login') || url.includes('/register') || url.includes('/user/create')) {
        // console.log("Menu Page Detected: Enabling Mouse");
        win.setIgnoreMouseEvents(false);
    } 
    // If we are on the main Avatar page, make it GHOST (Click-through) by default
    else {
        // console.log("Avatar Page Detected: Disabling Mouse");
        win.setIgnoreMouseEvents(true, { forward: true });
    }
  };

  // Trigger check when page loads
  win.webContents.on('did-finish-load', () => {
      updateMouseMode(win.webContents.getURL());
  });

  // Trigger check when you click a link (navigation)
  win.webContents.on('did-navigate', (event, url) => {
      updateMouseMode(url);
  });

  // --- IPC: MANUAL SWITCHING (For the Avatar Page) ---
  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const currentUrl = win.webContents.getURL();
    
    // Only allow the Avatar page to toggle ghost mode. 
    // The Dashboard should ALWAYS be clickable.
    if (!currentUrl.includes('/dashboard') && !currentUrl.includes('/login') && !currentUrl.includes('/register')) {
        win.setIgnoreMouseEvents(ignore, options);
    }
  });

  // --- PERMISSIONS ---
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    return callback(true);
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return true;
  });

  win.loadURL('http://127.0.0.1:5000');
}

app.commandLine.appendSwitch('enable-transparent-visuals');
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', 'http://127.0.0.1:5000');

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});