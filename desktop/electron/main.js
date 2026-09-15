import { app, BrowserWindow, Menu, ipcMain, screen } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { registerHandlers } from "./ipc-handlers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev =
  process.env.NODE_ENV === "development" || process.argv.includes("--dev") || !app.isPackaged;

Menu.setApplicationMenu(null);

let windowSeq = 0;
const posWindows = new Map();
let posWindowCounter = 0;

function createWindow({ posOnly = false } = {}) {
  windowSeq += 1;
  const isPrimary = windowSeq === 1;
  const posHash = posOnly ? "/pos?pos=1" : "/pos";

  const winOptions = {
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Faraz Pharmacy",
    icon: path.join(__dirname, "..", "src", "asset", "image", "logo.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
    titleBarStyle: "hiddenInset",
  };

  if (posOnly) {
    posWindowCounter++;
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    const cascadeOffset = (posWindowCounter - 1) * 30;
    const x = Math.min(Math.round((screenWidth - winOptions.width) / 2) + cascadeOffset, screenWidth - 200);
    const y = Math.min(Math.round((screenHeight - winOptions.height) / 2) + cascadeOffset, screenHeight - 200);
    winOptions.x = x;
    winOptions.y = y;
    winOptions.title = `Faraz Pharmacy - Sale ${posWindowCounter}`;
  }

  const win = new BrowserWindow(winOptions);

  if (posOnly) {
    const winId = win.id;
    posWindows.set(winId, win);
    win.on("closed", () => {
      posWindows.delete(winId);
      if (posWindows.size === 0) posWindowCounter = 0;
    });
  }

  if (isDev) {
    const DEV_URL = "http://localhost:5173";
    const loadDev = (attempt = 0) => {
      win
        .loadURL(`${DEV_URL}/#${posHash}`)
        .catch(() => {
          if (attempt < 60) {
            setTimeout(() => loadDev(attempt + 1), 500);
          }
        });
    };
    loadDev();
    if (isPrimary) {
      win.webContents.once("did-finish-load", () => win.webContents.openDevTools({ mode: "detach" }));
    }
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"), { hash: posHash });
  }

  win.once("ready-to-show", () => win.show());
  return win;
}

ipcMain.handle("pos:open-window", () => {
  try {
    const win = createWindow({ posOnly: true });
    if (win) return { success: true, windowId: win.id };
    return { success: false, error: "Could not create window" };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("pos:window-count", () => {
  return posWindows.size;
});

app.whenReady().then(() => {
  registerHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
