import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { WorkdayRecord, WorkshiftSettings } from "../src/types/workshift";
import { createShiftStore } from "./storage/shiftStore";
import { closeAppWindow, minimizeAppWindow } from "./windowControls";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

app.disableHardwareAcceleration();

function getControlWindow(eventSender: Electron.WebContents): BrowserWindow | null {
  return (
    BrowserWindow.getFocusedWindow() ??
    BrowserWindow.fromWebContents(eventSender) ??
    mainWindow ??
    BrowserWindow.getAllWindows().find((window) => !window.isDestroyed()) ??
    null
  );
}

function registerIpcHandlers(): void {
  const store = createShiftStore(path.join(app.getPath("userData"), "workshift-state.json"));

  ipcMain.handle("workshift:get-state", () => store.getState());
  ipcMain.handle("workshift:check-in", (_event, nowIso: string) => store.checkIn(nowIso));
  ipcMain.handle("workshift:check-out", (_event, nowIso: string) => store.checkOut(nowIso));
  ipcMain.handle("workshift:update-record", (_event, record: WorkdayRecord) =>
    store.updateRecord(record)
  );
  ipcMain.handle(
    "workshift:update-settings",
    (_event, settingsPatch: Partial<WorkshiftSettings>) =>
      store.updateSettings(settingsPatch)
  );
  ipcMain.handle("window:minimize", (event) => {
    const result = minimizeAppWindow(getControlWindow(event.sender));
    console.info("[window:minimize]", result);
    return result;
  });
  ipcMain.handle("window:close", (event) => {
    isQuitting = true;
    const result = closeAppWindow(getControlWindow(event.sender));
    console.info("[window:close]", result);
    return result;
  });
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function createTray(): void {
  if (tray) {
    return;
  }

  const trayIcon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIUlEQVR4AWNggID/DBgYGIY1gGE0DBqG0TBoGEYAQicCHyCD2rgAAAAASUVORK5CYII="
  );

  tray = new Tray(trayIcon);
  tray.setToolTip("WorkShift Tracker");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Show WorkShift Tracker",
        click: showMainWindow
      },
      {
        label: "Quit",
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
  tray.on("click", showMainWindow);
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 444,
    height: 760,
    minWidth: 380,
    minHeight: 680,
    frame: false,
    minimizable: true,
    show: false,
    title: "WorkShift Tracker",
    backgroundColor: "#f6f7f9",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.mjs"),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.setMenuBarVisibility(false);

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.webContents.once("did-finish-load", () => {
    void mainWindow?.webContents
      .executeJavaScript("Boolean(window.workshift)", true)
      .then((hasBridge) => {
        console.info("[preload] workshift bridge", hasBridge ? "ready" : "missing");
      });
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerIpcHandlers();
  createTray();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (isQuitting && process.platform !== "darwin") {
    app.quit();
  }
});
