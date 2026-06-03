import type { WindowControlResult } from "../src/types/electron-api";

type WindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WindowPositionStore = {
  getPositions(): {
    main?: WindowBounds;
    compact?: WindowBounds;
  };
  updatePositions(boundsPatch: {
    main?: WindowBounds;
    compact?: WindowBounds;
  }): void;
};

export type ControllableWindow = {
  isDestroyed(): boolean;
  getBounds(): WindowBounds;
  setBounds(bounds: WindowBounds): void;
  setMinimumSize(width: number, height: number): void;
  setSize(width: number, height: number): void;
  setAlwaysOnTop(flag: boolean, level?: "normal" | "floating" | "torn-off-menu" | "modal-panel" | "main-menu" | "status" | "pop-up-menu" | "screen-saver"): void;
  center(): void;
  close(): void;
  hide(): void;
};

const COMPACT_DEFAULT_WIDTH = 154;
const COMPACT_DEFAULT_HEIGHT = 80;
const COMPACT_MIN_WIDTH = 78;
const COMPACT_MIN_HEIGHT = 34;
const MAIN_WIDTH = 444;
const MAIN_HEIGHT = 760;
const MAIN_MIN_WIDTH = 380;
const MAIN_MIN_HEIGHT = 680;

let lastMainBounds: WindowBounds | undefined;
let lastCompactBounds: WindowBounds | undefined;

export function resetWindowControlPositionsForTest(): void {
  lastMainBounds = undefined;
  lastCompactBounds = undefined;
}

function getSavedPositions(positionStore?: WindowPositionStore): {
  main?: WindowBounds;
  compact?: WindowBounds;
} {
  return positionStore?.getPositions() ?? {
    main: lastMainBounds,
    compact: lastCompactBounds
  };
}

function savePositions(
  boundsPatch: { main?: WindowBounds; compact?: WindowBounds },
  positionStore?: WindowPositionStore
): void {
  if (positionStore) {
    positionStore.updatePositions(boundsPatch);
    return;
  }

  lastMainBounds = boundsPatch.main ?? lastMainBounds;
  lastCompactBounds = boundsPatch.compact ?? lastCompactBounds;
}

export function compactAppWindow(
  targetWindow: ControllableWindow | null,
  positionStore?: WindowPositionStore
): WindowControlResult {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { ok: false, action: "none", reason: "window-not-found" };
  }

  const mainBounds = targetWindow.getBounds();
  const savedPositions = getSavedPositions(positionStore);
  savePositions({ main: mainBounds }, positionStore);

  targetWindow.setMinimumSize(COMPACT_MIN_WIDTH, COMPACT_MIN_HEIGHT);
  targetWindow.setBounds(
    savedPositions.compact ?? {
      ...mainBounds,
      width: COMPACT_DEFAULT_WIDTH,
      height: COMPACT_DEFAULT_HEIGHT
    }
  );
  targetWindow.setAlwaysOnTop(true, "floating");
  return { ok: true, action: "compact" };
}

export function restoreAppWindow(
  targetWindow: ControllableWindow | null,
  positionStore?: WindowPositionStore
): WindowControlResult {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { ok: false, action: "none", reason: "window-not-found" };
  }

  const compactBounds = targetWindow.getBounds();
  const savedPositions = getSavedPositions(positionStore);
  savePositions({ compact: compactBounds }, positionStore);

  targetWindow.setMinimumSize(MAIN_MIN_WIDTH, MAIN_MIN_HEIGHT);
  targetWindow.setAlwaysOnTop(false);

  if (savedPositions.main) {
    targetWindow.setBounds(savedPositions.main);
  } else {
    targetWindow.setSize(MAIN_WIDTH, MAIN_HEIGHT);
    targetWindow.center();
  }

  return { ok: true, action: "restore" };
}

export function closeAppWindow(targetWindow: ControllableWindow | null): WindowControlResult {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { ok: false, action: "none", reason: "window-not-found" };
  }

  targetWindow.close();
  return { ok: true, action: "close" };
}

export function hideAppWindow(targetWindow: ControllableWindow | null): WindowControlResult {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { ok: false, action: "none", reason: "window-not-found" };
  }

  targetWindow.setAlwaysOnTop(false);
  targetWindow.hide();
  return { ok: true, action: "hide" };
}
