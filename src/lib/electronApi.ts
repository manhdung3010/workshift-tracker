import { format } from "date-fns";
import type { WindowControlResult, WorkshiftApi } from "../types/electron-api";
import type { WorkdayRecord, WorkshiftSettings, WorkshiftState } from "../types/workshift";

const BROWSER_STORAGE_KEY = "workshift-tracker-state";
const NO_ELECTRON_WINDOW_CONTROL: WindowControlResult = {
  ok: false,
  action: "none",
  reason: "electron-preload-missing"
};

const defaultState: WorkshiftState = {
  settings: {
    targetMinutes: 480,
    startAtLogin: true,
    showWidget: true,
    notifyOnComplete: true
  },
  records: []
};

let memoryState: WorkshiftState = defaultState;

function getElectronApi(): WorkshiftApi | undefined {
  return globalThis.window?.workshift;
}

function readBrowserState(): WorkshiftState {
  const raw = globalThis.window?.localStorage?.getItem(BROWSER_STORAGE_KEY);

  if (!raw) {
    return memoryState;
  }

  return {
    ...defaultState,
    ...(JSON.parse(raw) as Partial<WorkshiftState>),
    settings: {
      ...defaultState.settings,
      ...((JSON.parse(raw) as Partial<WorkshiftState>).settings ?? {})
    }
  };
}

function writeBrowserState(state: WorkshiftState): WorkshiftState {
  memoryState = state;
  globalThis.window?.localStorage?.setItem(BROWSER_STORAGE_KEY, JSON.stringify(state));
  return state;
}

function localDateKey(now: Date): string {
  return format(now, "yyyy-MM-dd");
}

function updateBrowserRecord(record: WorkdayRecord): WorkshiftState {
  const state = readBrowserState();
  const existingIndex = state.records.findIndex((item) => item.date === record.date);
  const records =
    existingIndex >= 0
      ? state.records.map((item, index) => (index === existingIndex ? record : item))
      : [...state.records, record];

  return writeBrowserState({ ...state, records });
}

const browserFallbackApi = {
  getState(): Promise<WorkshiftState> {
    return Promise.resolve(readBrowserState());
  },

  checkIn(now = new Date()): Promise<WorkshiftState> {
    const state = readBrowserState();
    const date = localDateKey(now);
    const existing = state.records.find((record) => record.date === date);

    if (existing?.checkOutAt) {
      return Promise.resolve(state);
    }

    return Promise.resolve(
      updateBrowserRecord({
        date,
        targetMinutes: state.settings.targetMinutes,
        note: "",
        isDayOff: false,
        isOvertime: false,
        ...existing,
        checkInAt: now.toISOString(),
        checkOutAt: undefined
      })
    );
  },

  checkOut(now = new Date()): Promise<WorkshiftState> {
    const state = readBrowserState();
    const date = localDateKey(now);
    const existing = state.records.find((record) => record.date === date);

    if (!existing?.checkInAt) {
      return Promise.resolve(state);
    }

    return Promise.resolve(updateBrowserRecord({ ...existing, checkOutAt: now.toISOString() }));
  },

  updateRecord(record: WorkdayRecord): Promise<WorkshiftState> {
    return Promise.resolve(updateBrowserRecord(record));
  },

  updateSettings(settingsPatch: Partial<WorkshiftSettings>): Promise<WorkshiftState> {
    const state = readBrowserState();

    return Promise.resolve(
      writeBrowserState({
        ...state,
        settings: {
          ...state.settings,
          ...settingsPatch
        }
      })
    );
  }
};

export const workshiftApi = {
  getState() {
    return getElectronApi()?.getState() ?? browserFallbackApi.getState();
  },

  checkIn(now = new Date()) {
    return getElectronApi()?.checkIn(now.toISOString()) ?? browserFallbackApi.checkIn(now);
  },

  checkOut(now = new Date()) {
    return getElectronApi()?.checkOut(now.toISOString()) ?? browserFallbackApi.checkOut(now);
  },

  updateRecord(record: WorkdayRecord) {
    return getElectronApi()?.updateRecord(record) ?? browserFallbackApi.updateRecord(record);
  },

  updateSettings(settingsPatch: Partial<WorkshiftSettings>) {
    return (
      getElectronApi()?.updateSettings(settingsPatch) ??
      browserFallbackApi.updateSettings(settingsPatch)
    );
  },

  minimizeWindow() {
    const electronApi = getElectronApi();

    if (!electronApi) {
      console.warn("[window:minimize]", NO_ELECTRON_WINDOW_CONTROL);
      return Promise.resolve(NO_ELECTRON_WINDOW_CONTROL);
    }

    return electronApi.minimizeWindow();
  },

  closeWindow() {
    const electronApi = getElectronApi();

    if (electronApi) {
      return electronApi.closeWindow();
    }

    globalThis.window?.close?.();
    return Promise.resolve({ ok: true, action: "close" });
  }
};
