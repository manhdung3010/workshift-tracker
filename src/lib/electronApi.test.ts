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
        notifyOnComplete: true
      },
      records: []
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
