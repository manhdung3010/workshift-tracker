import { describe, expect, it, vi } from "vitest";
import { minimizeAppWindow } from "./windowControls";

describe("window controls", () => {
  it("hides windows when sending the app to the tray", () => {
    const targetWindow = {
      isDestroyed: () => false,
      isMinimizable: () => true,
      isMinimized: () => true,
      minimize: vi.fn(),
      hide: vi.fn(),
      close: vi.fn()
    };

    const result = minimizeAppWindow(targetWindow);

    expect(targetWindow.minimize).not.toHaveBeenCalled();
    expect(targetWindow.hide).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, action: "hide", reason: "sent-to-tray" });
  });

  it("hides non-minimizable windows when sending the app to the tray", () => {
    const targetWindow = {
      isDestroyed: () => false,
      isMinimizable: () => false,
      isMinimized: () => false,
      minimize: vi.fn(),
      hide: vi.fn(),
      close: vi.fn()
    };

    const result = minimizeAppWindow(targetWindow);

    expect(targetWindow.minimize).not.toHaveBeenCalled();
    expect(targetWindow.hide).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, action: "hide", reason: "sent-to-tray" });
  });

  it("reports when no window is available", () => {
    expect(minimizeAppWindow(null)).toEqual({
      ok: false,
      action: "none",
      reason: "window-not-found"
    });
  });
});
