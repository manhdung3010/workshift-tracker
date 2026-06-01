import type { WorkdayRecord, WorkshiftSettings, WorkshiftState } from "./workshift";

export type WindowControlResult = {
  ok: boolean;
  action: "minimize" | "hide" | "compact" | "restore" | "close" | "quit" | "none";
  reason?: string;
};

export type WorkshiftApi = {
  appName: string;
  getState(): Promise<WorkshiftState>;
  checkIn(nowIso: string): Promise<WorkshiftState>;
  checkOut(nowIso: string): Promise<WorkshiftState>;
  updateRecord(record: WorkdayRecord): Promise<WorkshiftState>;
  deleteRecord(date: string): Promise<WorkshiftState>;
  updateSettings(settingsPatch: Partial<WorkshiftSettings>): Promise<WorkshiftState>;
  minimizeWindow(): Promise<WindowControlResult>;
  restoreWindow(): Promise<WindowControlResult>;
  closeWindow(): Promise<WindowControlResult>;
  quitApp(): Promise<WindowControlResult>;
};
