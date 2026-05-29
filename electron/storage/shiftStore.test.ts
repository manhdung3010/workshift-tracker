import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createShiftStore, DEFAULT_SETTINGS } from "./shiftStore";

let tempDirs: string[] = [];

function tempStatePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "workshift-store-"));
  tempDirs.push(dir);
  return join(dir, "state.json");
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("createShiftStore", () => {
  it("returns default local state when the file does not exist", () => {
    const store = createShiftStore(tempStatePath());

    expect(store.getState()).toEqual({
      settings: DEFAULT_SETTINGS,
      records: []
    });
  });

  it("creates today's local record on check-in", () => {
    const store = createShiftStore(tempStatePath());
    const state = store.checkIn("2026-05-29T01:15:00.000Z");

    expect(state.records).toEqual([
      {
        date: "2026-05-29",
        checkInAt: "2026-05-29T01:15:00.000Z",
        targetMinutes: DEFAULT_SETTINGS.targetMinutes,
        note: "",
        isDayOff: false,
        isOvertime: false
      }
    ]);
  });

  it("persists state to disk between store instances", () => {
    const path = tempStatePath();

    createShiftStore(path).checkIn("2026-05-29T01:15:00.000Z");

    expect(createShiftStore(path).getState().records[0]?.checkInAt).toBe(
      "2026-05-29T01:15:00.000Z"
    );
  });

  it("records checkout for the current local day", () => {
    const store = createShiftStore(tempStatePath());

    store.checkIn("2026-05-29T01:15:00.000Z");
    const state = store.checkOut("2026-05-29T09:00:00.000Z");

    expect(state.records[0]?.checkOutAt).toBe("2026-05-29T09:00:00.000Z");
  });

  it("does not start a second shift after today's checkout", () => {
    const store = createShiftStore(tempStatePath());

    store.checkIn("2026-05-29T01:15:00.000Z");
    store.checkOut("2026-05-29T09:00:00.000Z");
    const state = store.checkIn("2026-05-29T10:00:00.000Z");

    expect(state.records[0]?.checkInAt).toBe("2026-05-29T01:15:00.000Z");
    expect(state.records[0]?.checkOutAt).toBe("2026-05-29T09:00:00.000Z");
  });

  it("updates settings without dropping records", () => {
    const store = createShiftStore(tempStatePath());

    store.checkIn("2026-05-29T01:15:00.000Z");
    const state = store.updateSettings({ targetMinutes: 450, showWidget: false });

    expect(state.settings).toEqual({
      ...DEFAULT_SETTINGS,
      targetMinutes: 450,
      showWidget: false
    });
    expect(state.records).toHaveLength(1);
  });

  it("updates an existing record by date", () => {
    const store = createShiftStore(tempStatePath());

    store.checkIn("2026-05-29T01:15:00.000Z");
    const state = store.updateRecord({
      date: "2026-05-29",
      checkInAt: "2026-05-29T01:15:00.000Z",
      targetMinutes: 480,
      note: "Remote day",
      isDayOff: false,
      isOvertime: true
    });

    expect(state.records[0]?.note).toBe("Remote day");
    expect(state.records[0]?.isOvertime).toBe(true);
  });
});
