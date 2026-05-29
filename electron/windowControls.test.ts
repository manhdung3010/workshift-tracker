import { describe, expect, it, vi } from "vitest";
import { compactAppWindow, restoreAppWindow } from "./windowControls";

describe("window controls", () => {
  it("resizes windows into compact mode", () => {
    const targetWindow = {
      isDestroyed: () => false,
      setMinimumSize: vi.fn(),
      setSize: vi.fn(),
      setAlwaysOnTop: vi.fn(),
      center: vi.fn(),
      close: vi.fn()
    };

    const result = compactAppWindow(targetWindow);

    expect(targetWindow.setMinimumSize).toHaveBeenCalledWith(220, 150);
    expect(targetWindow.setSize).toHaveBeenCalledWith(220, 150);
    expect(targetWindow.setAlwaysOnTop).toHaveBeenCalledWith(true, "floating");
    expect(result).toEqual({ ok: true, action: "compact" });
  });

  it("restores compact windows into the main app size", () => {
    const targetWindow = {
      isDestroyed: () => false,
      setMinimumSize: vi.fn(),
      setSize: vi.fn(),
      setAlwaysOnTop: vi.fn(),
      center: vi.fn(),
      close: vi.fn()
    };

    const result = restoreAppWindow(targetWindow);

    expect(targetWindow.setMinimumSize).toHaveBeenCalledWith(380, 680);
    expect(targetWindow.setSize).toHaveBeenCalledWith(444, 760);
    expect(targetWindow.setAlwaysOnTop).toHaveBeenCalledWith(false);
    expect(targetWindow.center).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, action: "restore" });
  });

  it("reports when no window is available", () => {
    expect(compactAppWindow(null)).toEqual({
      ok: false,
      action: "none",
      reason: "window-not-found"
    });
    expect(restoreAppWindow(null)).toEqual({
      ok: false,
      action: "none",
      reason: "window-not-found"
    });
  });
});
