export type ShiftStatus = "not_started" | "working" | "completed" | "checked_out";

export type WorkdayRecord = {
  date: string;
  checkInAt?: string;
  checkOutAt?: string;
  targetMinutes: number;
  note: string;
  isDayOff: boolean;
  isOvertime: boolean;
};

export type WorkshiftSettings = {
  targetMinutes: number;
  startAtLogin: boolean;
  showWidget: boolean;
  notifyOnComplete: boolean;
  notifyStartReminder: boolean;
  startReminderIntervalMinutes: number;
  workStartTime: string;
  workEndTime: string;
  lunchStartTime: string;
  lunchEndTime: string;
  workdays: number[];
};

export type WorkshiftState = {
  settings: WorkshiftSettings;
  records: WorkdayRecord[];
};
