import { afterEach, describe, expect, it, vi } from "vitest";
import { workshiftApi } from "./electronApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("workshiftApi", () => {
  it("does not crash when Electron preload API is missing", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        value: undefined as string | undefined,
        getItem() {
          return this.value ?? null;
        },
        setItem(_key: string, value: string) {
          this.value = value;
        }
      }
    });

    await expect(workshiftApi.getState()).resolves.toEqual({
      settings: {
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
      },
      records: [],
      windowBounds: {}
    });
  });

  it("falls back to the browser close API when Electron preload API is missing", async () => {
    const close = vi.fn();

    vi.stubGlobal("window", {
      close
    });

    await workshiftApi.closeWindow();

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("does not crash when an older Electron preload API is missing deleteRecord", async () => {
    vi.stubGlobal("window", {
      workshift: {},
      localStorage: {
        value: JSON.stringify({
          records: [
            {
              date: "2026-05-29",
              checkInAt: "2026-05-29T01:00:00.000Z",
              targetMinutes: 480,
              note: "",
              isDayOff: false,
              isOvertime: false
            }
          ]
        }),
        getItem() {
          return this.value;
        },
        setItem(_key: string, value: string) {
          this.value = value;
        }
      }
    });

    await expect(workshiftApi.deleteRecord("2026-05-29")).resolves.toMatchObject({
      records: []
    });
  });

  it("keeps the Electron quit API for the tray Quit menu", async () => {
    const quitApp = vi.fn().mockResolvedValue({ ok: true, action: "quit" });

    vi.stubGlobal("window", {
      workshift: {
        quitApp
      }
    });

    await workshiftApi.quitApp();

    expect(quitApp).toHaveBeenCalledTimes(1);
  });
});
