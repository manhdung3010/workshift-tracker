import type { WindowControlResult } from "../src/types/electron-api";

export type ControllableWindow = {
  isDestroyed(): boolean;
  isMinimizable(): boolean;
  isMinimized(): boolean;
  minimize(): void;
  hide(): void;
  close(): void;
};

export function minimizeAppWindow(targetWindow: ControllableWindow | null): WindowControlResult {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { ok: false, action: "none", reason: "window-not-found" };
  }

  targetWindow.hide();
  return { ok: true, action: "hide", reason: "sent-to-tray" };
}

export function closeAppWindow(targetWindow: ControllableWindow | null): WindowControlResult {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { ok: false, action: "none", reason: "window-not-found" };
  }

  targetWindow.close();
  return { ok: true, action: "close" };
}
