import type { WorkdayRecord, WorkshiftSettings, WorkshiftState } from "./workshift";

export type WindowControlResult = {
  ok: boolean;
  action: "minimize" | "hide" | "close" | "none";
  reason?: string;
};

export type WorkshiftApi = {
  appName: string;
  getState(): Promise<WorkshiftState>;
  checkIn(nowIso: string): Promise<WorkshiftState>;
  checkOut(nowIso: string): Promise<WorkshiftState>;
  updateRecord(record: WorkdayRecord): Promise<WorkshiftState>;
  updateSettings(settingsPatch: Partial<WorkshiftSettings>): Promise<WorkshiftState>;
  minimizeWindow(): Promise<WindowControlResult>;
  closeWindow(): Promise<WindowControlResult>;
};
