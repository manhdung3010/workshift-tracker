import { app, Menu, BrowserWindow, ipcMain, nativeImage, Tray } from "electron";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { format } from "date-fns";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const DEFAULT_SETTINGS = {
  targetMinutes: 480,
  startAtLogin: true,
  showWidget: true,
  notifyOnComplete: true,
  notifyStartReminder: true,
  startReminderIntervalMinutes: 5,
  workStartTime: "09:00",
  workEndTime: "18:00",
  lunchStartTime: "12:00",
  lunchEndTime: "13:00",
  workdays: [1, 2, 3, 4, 5]
};
function localDateKey(nowIso) {
  return format(new Date(nowIso), "yyyy-MM-dd");
}
function defaultState() {
  return {
    settings: DEFAULT_SETTINGS,
    records: []
  };
}
function normalizeState(input) {
  return {
    settings: {
      ...DEFAULT_SETTINGS,
      ...input.settings ?? {}
    },
    records: input.records ?? []
  };
}
function createShiftStore(filePath) {
  function readState() {
    if (!existsSync(filePath)) {
      return defaultState();
    }
    const raw = readFileSync(filePath, "utf8");
    return normalizeState(JSON.parse(raw));
  }
  function writeState(state) {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(state, null, 2)}
`, "utf8");
    return state;
  }
  function upsertRecord(record) {
    const state = readState();
    const existingIndex = state.records.findIndex((item) => item.date === record.date);
    const records = existingIndex >= 0 ? state.records.map((item, index) => index === existingIndex ? record : item) : [...state.records, record];
    return writeState({
      ...state,
      records: records.sort((left, right) => left.date.localeCompare(right.date))
    });
  }
  return {
    getState() {
      return readState();
    },
    checkIn(nowIso) {
      const state = readState();
      const today = localDateKey(nowIso);
      const existing = state.records.find((record) => record.date === today);
      if (existing?.checkOutAt) {
        return state;
      }
      return upsertRecord({
        date: today,
        targetMinutes: state.settings.targetMinutes,
        note: "",
        isDayOff: false,
        isOvertime: false,
        ...existing,
        checkInAt: nowIso,
        checkOutAt: void 0
      });
    },
    checkOut(nowIso) {
      const state = readState();
      const today = localDateKey(nowIso);
      const existing = state.records.find((record) => record.date === today);
      if (!existing?.checkInAt) {
        return state;
      }
      return upsertRecord({
        ...existing,
        checkOutAt: nowIso
      });
    },
    updateRecord(record) {
      return upsertRecord(record);
    },
    updateSettings(settingsPatch) {
      const state = readState();
      return writeState({
        ...state,
        settings: {
          ...state.settings,
          ...settingsPatch
        }
      });
    }
  };
}
const COMPACT_WIDTH = 220;
const COMPACT_HEIGHT = 150;
const MAIN_WIDTH = 444;
const MAIN_HEIGHT = 760;
const MAIN_MIN_WIDTH = 380;
const MAIN_MIN_HEIGHT = 680;
function compactAppWindow(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { ok: false, action: "none", reason: "window-not-found" };
  }
  targetWindow.setMinimumSize(COMPACT_WIDTH, COMPACT_HEIGHT);
  targetWindow.setSize(COMPACT_WIDTH, COMPACT_HEIGHT);
  targetWindow.setAlwaysOnTop(true, "floating");
  return { ok: true, action: "compact" };
}
function restoreAppWindow(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { ok: false, action: "none", reason: "window-not-found" };
  }
  targetWindow.setMinimumSize(MAIN_MIN_WIDTH, MAIN_MIN_HEIGHT);
  targetWindow.setSize(MAIN_WIDTH, MAIN_HEIGHT);
  targetWindow.setAlwaysOnTop(false);
  targetWindow.center();
  return { ok: true, action: "restore" };
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
let mainWindow = null;
let tray = null;
let isQuitting = false;
app.disableHardwareAcceleration();
function getControlWindow(eventSender) {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.fromWebContents(eventSender) ?? mainWindow ?? BrowserWindow.getAllWindows().find((window) => !window.isDestroyed()) ?? null;
}
function registerIpcHandlers() {
  const store = createShiftStore(path.join(app.getPath("userData"), "workshift-state.json"));
  app.setLoginItemSettings({
    openAtLogin: store.getState().settings.startAtLogin
  });
  ipcMain.handle("workshift:get-state", () => store.getState());
  ipcMain.handle("workshift:check-in", (_event, nowIso) => store.checkIn(nowIso));
  ipcMain.handle("workshift:check-out", (_event, nowIso) => store.checkOut(nowIso));
  ipcMain.handle(
    "workshift:update-record",
    (_event, record) => store.updateRecord(record)
  );
  ipcMain.handle(
    "workshift:update-settings",
    (_event, settingsPatch) => {
      const nextState = store.updateSettings(settingsPatch);
      if (settingsPatch.startAtLogin !== void 0) {
        app.setLoginItemSettings({
          openAtLogin: settingsPatch.startAtLogin
        });
      }
      return nextState;
    }
  );
  ipcMain.handle("window:minimize", (event) => {
    const result = compactAppWindow(getControlWindow(event.sender));
    console.info("[window:minimize]", result);
    return result;
  });
  ipcMain.handle("window:restore", (event) => {
    const result = restoreAppWindow(getControlWindow(event.sender));
    console.info("[window:restore]", result);
    return result;
  });
  ipcMain.handle("window:close", (event) => {
    const result = compactAppWindow(getControlWindow(event.sender));
    console.info("[window:close]", result);
    return result;
  });
  ipcMain.handle("app:quit", () => {
    console.info("[app:quit]");
    quitApp();
    return { ok: true, action: "quit" };
  });
}
function quitApp() {
  isQuitting = true;
  tray?.destroy();
  tray = null;
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.destroy();
    }
  }
  app.exit(0);
}
function showMainWindow() {
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
function createTray() {
  if (tray) {
    return;
  }
  const trayIcon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAXklEQVR42u3WUQoAEAyA4Z3Pq8M6Hu8KI8P0Ky+bra9MkRhSvrkFAAAArUS9Zhtr6wEAAOAHoGm2UuMHUMd6581m4DqghRjFzAC9uzZ9hppB+xuwI/8+gD8hAACnAAUZxJvx1iSzfgAAAABJRU5ErkJggg=="
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
        click: quitApp
      }
    ])
  );
  tray.on("click", showMainWindow);
}
function createMainWindow() {
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
      preload: path.join(__dirname$1, "../preload/preload.mjs"),
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
    void mainWindow.loadFile(path.join(__dirname$1, "../renderer/index.html"));
  }
  mainWindow.webContents.once("did-finish-load", () => {
    void mainWindow?.webContents.executeJavaScript("Boolean(window.workshift)", true).then((hasBridge) => {
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
app.on("before-quit", () => {
  isQuitting = true;
});
app.on("window-all-closed", () => {
  if (isQuitting && process.platform !== "darwin") {
    app.quit();
  }
});
