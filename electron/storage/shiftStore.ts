import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { format } from "date-fns";
import type {
  WorkdayRecord,
  WorkshiftSettings,
  WorkshiftState
} from "../../src/types/workshift";

export const DEFAULT_SETTINGS: WorkshiftSettings = {
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

export type ShiftStore = {
  getState(): WorkshiftState;
  checkIn(nowIso: string): WorkshiftState;
  checkOut(nowIso: string): WorkshiftState;
  updateRecord(record: WorkdayRecord): WorkshiftState;
  updateSettings(settingsPatch: Partial<WorkshiftSettings>): WorkshiftState;
};

function localDateKey(nowIso: string): string {
  return format(new Date(nowIso), "yyyy-MM-dd");
}

function defaultState(): WorkshiftState {
  return {
    settings: DEFAULT_SETTINGS,
    records: []
  };
}

function normalizeState(input: Partial<WorkshiftState>): WorkshiftState {
  return {
    settings: {
      ...DEFAULT_SETTINGS,
      ...(input.settings ?? {})
    },
    records: input.records ?? []
  };
}

export function createShiftStore(filePath: string): ShiftStore {
  function readState(): WorkshiftState {
    if (!existsSync(filePath)) {
      return defaultState();
    }

    const raw = readFileSync(filePath, "utf8");
    return normalizeState(JSON.parse(raw) as Partial<WorkshiftState>);
  }

  function writeState(state: WorkshiftState): WorkshiftState {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    return state;
  }

  function upsertRecord(record: WorkdayRecord): WorkshiftState {
    const state = readState();
    const existingIndex = state.records.findIndex((item) => item.date === record.date);
    const records =
      existingIndex >= 0
        ? state.records.map((item, index) => (index === existingIndex ? record : item))
        : [...state.records, record];

    return writeState({
      ...state,
      records: records.sort((left, right) => left.date.localeCompare(right.date))
    });
  }

  return {
    getState() {
      return readState();
    },

    checkIn(nowIso: string) {
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
        checkOutAt: undefined
      });
    },

    checkOut(nowIso: string) {
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

    updateRecord(record: WorkdayRecord) {
      return upsertRecord(record);
    },

    updateSettings(settingsPatch: Partial<WorkshiftSettings>) {
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
