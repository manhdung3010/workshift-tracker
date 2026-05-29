import type { WindowControlResult } from "../src/types/electron-api";

export type ControllableWindow = {
  isDestroyed(): boolean;
  setMinimumSize(width: number, height: number): void;
  setSize(width: number, height: number): void;
  setAlwaysOnTop(flag: boolean, level?: "normal" | "floating" | "torn-off-menu" | "modal-panel" | "main-menu" | "status" | "pop-up-menu" | "screen-saver"): void;
  center(): void;
  close(): void;
};

const COMPACT_WIDTH = 220;
const COMPACT_HEIGHT = 150;
const MAIN_WIDTH = 444;
const MAIN_HEIGHT = 760;
const MAIN_MIN_WIDTH = 380;
const MAIN_MIN_HEIGHT = 680;

export function compactAppWindow(targetWindow: ControllableWindow | null): WindowControlResult {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { ok: false, action: "none", reason: "window-not-found" };
  }

  targetWindow.setMinimumSize(COMPACT_WIDTH, COMPACT_HEIGHT);
  targetWindow.setSize(COMPACT_WIDTH, COMPACT_HEIGHT);
  targetWindow.setAlwaysOnTop(true, "floating");
  return { ok: true, action: "compact" };
}

export function restoreAppWindow(targetWindow: ControllableWindow | null): WindowControlResult {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { ok: false, action: "none", reason: "window-not-found" };
  }

  targetWindow.setMinimumSize(MAIN_MIN_WIDTH, MAIN_MIN_HEIGHT);
  targetWindow.setSize(MAIN_WIDTH, MAIN_HEIGHT);
  targetWindow.setAlwaysOnTop(false);
  targetWindow.center();
  return { ok: true, action: "restore" };
}

export function closeAppWindow(targetWindow: ControllableWindow | null): WindowControlResult {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { ok: false, action: "none", reason: "window-not-found" };
  }

  targetWindow.close();
  return { ok: true, action: "close" };
}
