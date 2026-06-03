import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  compactAppWindow,
  hideAppWindow,
  resetWindowControlPositionsForTest,
  restoreAppWindow
} from "./windowControls";

describe("window controls", () => {
  beforeEach(() => {
    resetWindowControlPositionsForTest();
  });

  function targetWindow(bounds = { x: 40, y: 50, width: 444, height: 760 }) {
    return {
      isDestroyed: () => false,
      getBounds: vi.fn(() => bounds),
      setBounds: vi.fn(),
      setMinimumSize: vi.fn(),
      setSize: vi.fn(),
      setAlwaysOnTop: vi.fn(),
      center: vi.fn(),
      close: vi.fn(),
      hide: vi.fn()
    };
  }

  it("resizes windows into compact mode", () => {
    const targetWindowMock = targetWindow();

    const result = compactAppWindow(targetWindowMock);

    expect(targetWindowMock.setMinimumSize).toHaveBeenCalledWith(78, 34);
    expect(targetWindowMock.setBounds).toHaveBeenCalledWith({ x: 40, y: 50, width: 154, height: 80 });
    expect(targetWindowMock.setAlwaysOnTop).toHaveBeenCalledWith(true, "floating");
    expect(result).toEqual({ ok: true, action: "compact" });
  });

  it("restores compact windows into the main app size", () => {
    const targetWindowMock = targetWindow();

    const result = restoreAppWindow(targetWindowMock);

    expect(targetWindowMock.setMinimumSize).toHaveBeenCalledWith(380, 680);
    expect(targetWindowMock.setSize).toHaveBeenCalledWith(444, 760);
    expect(targetWindowMock.setAlwaysOnTop).toHaveBeenCalledWith(false);
    expect(targetWindowMock.center).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, action: "restore" });
  });

  it("remembers main and compact positions and size when switching modes", () => {
    const mainWindowMock = targetWindow({ x: 120, y: 140, width: 444, height: 760 });
    compactAppWindow(mainWindowMock);

    const compactWindowMock = targetWindow({ x: 700, y: 80, width: 96, height: 38 });
    restoreAppWindow(compactWindowMock);

    expect(compactWindowMock.setBounds).toHaveBeenCalledWith({
      x: 120,
      y: 140,
      width: 444,
      height: 760
    });
    expect(compactWindowMock.center).not.toHaveBeenCalled();

    const nextMainWindowMock = targetWindow({ x: 200, y: 220, width: 444, height: 760 });
    compactAppWindow(nextMainWindowMock);

    expect(nextMainWindowMock.setBounds).toHaveBeenCalledWith({
      x: 700,
      y: 80,
      width: 96,
      height: 38
    });
  });

  it("hides windows without quitting the app", () => {
    const targetWindowMock = targetWindow();

    const result = hideAppWindow(targetWindowMock);

    expect(targetWindowMock.hide).toHaveBeenCalledTimes(1);
    expect(targetWindowMock.close).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, action: "hide" });
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
    expect(hideAppWindow(null)).toEqual({
      ok: false,
      action: "none",
      reason: "window-not-found"
    });
  });
});
