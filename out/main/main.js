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
  lunchEndTime: "13:30",
  workdays: [1, 2, 3, 4, 5]
};
function localDateKey(nowIso) {
  return format(new Date(nowIso), "yyyy-MM-dd");
}
function defaultState() {
  return {
    settings: DEFAULT_SETTINGS,
    records: [],
    windowBounds: {}
  };
}
function normalizeState(input) {
  return {
    settings: {
      ...DEFAULT_SETTINGS,
      ...input.settings ?? {}
    },
    records: input.records ?? [],
    windowBounds: normalizeWindowBounds(input.windowBounds)
  };
}
function normalizeWindowBounds(input) {
  return {
    main: normalizeBounds(input?.main),
    compact: normalizeBounds(input?.compact)
  };
}
function normalizeBounds(input) {
  if (typeof input?.x !== "number" || typeof input.y !== "number" || typeof input.width !== "number" || typeof input.height !== "number") {
    return void 0;
  }
  return {
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height
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
    deleteRecord(date) {
      const state = readState();
      return writeState({
        ...state,
        records: state.records.filter((record) => record.date !== date)
      });
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
    },
    updateWindowBounds(boundsPatch) {
      const state = readState();
      return writeState({
        ...state,
        windowBounds: normalizeWindowBounds({
          ...state.windowBounds,
          ...boundsPatch
        })
      });
    }
  };
}
const COMPACT_DEFAULT_WIDTH = 154;
const COMPACT_DEFAULT_HEIGHT = 80;
const COMPACT_MIN_WIDTH = 78;
const COMPACT_MIN_HEIGHT = 34;
const MAIN_WIDTH = 444;
const MAIN_HEIGHT = 760;
const MAIN_MIN_WIDTH = 380;
const MAIN_MIN_HEIGHT = 680;
let lastMainBounds;
let lastCompactBounds;
function getSavedPositions(positionStore) {
  return positionStore?.getPositions() ?? {
    main: lastMainBounds,
    compact: lastCompactBounds
  };
}
function savePositions(boundsPatch, positionStore) {
  if (positionStore) {
    positionStore.updatePositions(boundsPatch);
    return;
  }
  lastMainBounds = boundsPatch.main ?? lastMainBounds;
  lastCompactBounds = boundsPatch.compact ?? lastCompactBounds;
}
function compactAppWindow(targetWindow, positionStore) {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { ok: false, action: "none", reason: "window-not-found" };
  }
  const mainBounds = targetWindow.getBounds();
  const savedPositions = getSavedPositions(positionStore);
  savePositions({ main: mainBounds }, positionStore);
  targetWindow.setMinimumSize(COMPACT_MIN_WIDTH, COMPACT_MIN_HEIGHT);
  targetWindow.setBounds(
    savedPositions.compact ?? {
      ...mainBounds,
      width: COMPACT_DEFAULT_WIDTH,
      height: COMPACT_DEFAULT_HEIGHT
    }
  );
  targetWindow.setAlwaysOnTop(true, "floating");
  return { ok: true, action: "compact" };
}
function restoreAppWindow(targetWindow, positionStore) {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { ok: false, action: "none", reason: "window-not-found" };
  }
  const compactBounds = targetWindow.getBounds();
  const savedPositions = getSavedPositions(positionStore);
  savePositions({ compact: compactBounds }, positionStore);
  targetWindow.setMinimumSize(MAIN_MIN_WIDTH, MAIN_MIN_HEIGHT);
  targetWindow.setAlwaysOnTop(false);
  if (savedPositions.main) {
    targetWindow.setBounds(savedPositions.main);
  } else {
    targetWindow.setSize(MAIN_WIDTH, MAIN_HEIGHT);
    targetWindow.center();
  }
  return { ok: true, action: "restore" };
}
function hideAppWindow(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { ok: false, action: "none", reason: "window-not-found" };
  }
  targetWindow.setAlwaysOnTop(false);
  targetWindow.hide();
  return { ok: true, action: "hide" };
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
let mainWindow = null;
let tray = null;
let isQuitting = false;
let store = null;
app.disableHardwareAcceleration();
function getControlWindow(eventSender) {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.fromWebContents(eventSender) ?? mainWindow ?? BrowserWindow.getAllWindows().find((window) => !window.isDestroyed()) ?? null;
}
function registerIpcHandlers() {
  const appStore = createShiftStore(path.join(app.getPath("userData"), "workshift-state.json"));
  store = appStore;
  app.setLoginItemSettings({
    openAtLogin: appStore.getState().settings.startAtLogin
  });
  const windowPositionStore = {
    getPositions: () => appStore.getState().windowBounds,
    updatePositions: (boundsPatch) => {
      appStore.updateWindowBounds(boundsPatch);
    }
  };
  ipcMain.handle("workshift:get-state", () => appStore.getState());
  ipcMain.handle("workshift:check-in", (_event, nowIso) => appStore.checkIn(nowIso));
  ipcMain.handle("workshift:check-out", (_event, nowIso) => appStore.checkOut(nowIso));
  ipcMain.handle(
    "workshift:update-record",
    (_event, record) => appStore.updateRecord(record)
  );
  ipcMain.handle("workshift:delete-record", (_event, date) => appStore.deleteRecord(date));
  ipcMain.handle(
    "workshift:update-settings",
    (_event, settingsPatch) => {
      const nextState = appStore.updateSettings(settingsPatch);
      if (settingsPatch.startAtLogin !== void 0) {
        app.setLoginItemSettings({
          openAtLogin: settingsPatch.startAtLogin
        });
      }
      return nextState;
    }
  );
  ipcMain.handle("window:minimize", (event) => {
    const result = compactAppWindow(getControlWindow(event.sender), windowPositionStore);
    console.info("[window:minimize]", result);
    return result;
  });
  ipcMain.handle("window:restore", (event) => {
    const result = restoreAppWindow(getControlWindow(event.sender), windowPositionStore);
    console.info("[window:restore]", result);
    return result;
  });
  ipcMain.handle("window:close", (event) => {
    const result = hideAppWindow(getControlWindow(event.sender));
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
  const savedMainBounds = store?.getState().windowBounds.main;
  mainWindow = new BrowserWindow({
    width: savedMainBounds?.width ?? 444,
    height: savedMainBounds?.height ?? 760,
    x: savedMainBounds?.x,
    y: savedMainBounds?.y,
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
