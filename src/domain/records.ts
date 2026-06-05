import type { WorkdayRecord, WorkshiftSettings } from "../types/workshift";
import { elapsedWorkMinutesWithSchedule } from "./schedule";
import { dateKeyWithTime, elapsedMinutes, formatDuration } from "./time";

export type WeeklyTotal = {
  weekLabel: string;
  minutes: number;
};

export type WorkdayLogRow = {
  date: string;
  day: string;
  weekday: string;
  time: string;
  total: string;
  badge: string;
  tone: "success" | "warning" | "danger" | "muted";
};

export type WorkdayRecordTimeInput = {
  existing?: WorkdayRecord;
  date: string;
  checkInTime: string;
  checkOutTime?: string;
  targetMinutes: number;
};

export function buildWorkdayRecordFromTimes({
  existing,
  date,
  checkInTime,
  checkOutTime,
  targetMinutes
}: WorkdayRecordTimeInput): WorkdayRecord {
  const checkInAt = dateKeyWithTime(date, checkInTime);
  return {
    date,
    targetMinutes,
    note: "",
    isDayOff: false,
    isOvertime: false,
    ...existing,
    checkInAt: checkInAt.toISOString(),
    checkOutAt: checkOutTime ? dateKeyWithTime(date, checkOutTime).toISOString() : undefined
  };
}

function isInMonth(record: WorkdayRecord, month: string): boolean {
  return record.date.startsWith(`${month}-`);
}

function weekOfMonth(date: string): number {
  const year = Number(date.slice(0, 4));
  const monthIndex = Number(date.slice(5, 7)) - 1;
  const day = Number(date.slice(8, 10));
  const firstDayOfMonth = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const mondayStartOffset = (firstDayOfMonth + 6) % 7;

  return Math.floor((mondayStartOffset + day - 1) / 7) + 1;
}

export function monthlyTotalMinutes(
  records: WorkdayRecord[],
  month: string,
  now = new Date(),
  settings?: WorkshiftSettings
): number {
  return records
    .filter((record) => isInMonth(record, month))
    .reduce((total, record) => total + loggedMinutes(record, now, settings), 0);
}

export function workedDays(records: WorkdayRecord[], month: string): number {
  return records.filter((record) => isInMonth(record, month) && Boolean(record.checkInAt))
    .length;
}

export function dayOffCount(records: WorkdayRecord[], month: string): number {
  return records.filter((record) => isInMonth(record, month) && record.isDayOff).length;
}

export function missingDays(
  records: WorkdayRecord[],
  month: string,
  now: Date
): WorkdayRecord[] {
  return records.filter((record) => {
    if (!isInMonth(record, month) || record.isDayOff || !record.checkInAt) {
      return false;
    }

    return elapsedMinutes(record, now) < record.targetMinutes;
  });
}

export function weeklyTotals(records: WorkdayRecord[], month: string): WeeklyTotal[] {
  const totals = new Map<number, number>();

  for (const record of records) {
    if (!isInMonth(record, month)) {
      continue;
    }

    const week = weekOfMonth(record.date);
    totals.set(week, (totals.get(week) ?? 0) + elapsedMinutes(record, new Date()));
  }

  return Array.from(totals.entries())
    .filter(([, minutes]) => minutes > 0)
    .sort(([leftWeek], [rightWeek]) => leftWeek - rightWeek)
    .map(([week, minutes]) => ({
      weekLabel: `Tuần ${week}`,
      minutes
    }));
}

function localDateFromKey(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

function localTimeLabel(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function weekdayLabel(date: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(localDateFromKey(date));
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function loggedMinutes(
  record: WorkdayRecord,
  now: Date,
  settings: WorkshiftSettings | undefined
): number {
  if (!record.checkInAt || !record.checkOutAt) {
    return 0;
  }

  if (!settings) {
    return elapsedMinutes(record, now);
  }

  return elapsedWorkMinutesWithSchedule({
    settings,
    checkInAt: new Date(record.checkInAt),
    now: new Date(record.checkOutAt)
  });
}

export function workdayLogRows(
  records: WorkdayRecord[],
  month: string,
  now: Date,
  settings?: WorkshiftSettings
): WorkdayLogRow[] {
  return records
    .filter((record) => isInMonth(record, month))
    .sort((left, right) => right.date.localeCompare(left.date))
    .map((record) => {
      const day = record.date.slice(8, 10);

      if (record.isDayOff) {
        return {
          date: record.date,
          day,
          weekday: weekdayLabel(record.date),
          time: "Day off",
          total: "-",
          badge: "Day off",
          tone: "muted"
        };
      }

      if (!record.checkInAt) {
        return {
          date: record.date,
          day,
          weekday: weekdayLabel(record.date),
          time: "Not started",
          total: "-",
          badge: "Idle",
          tone: "muted"
        };
      }

      const checkIn = localTimeLabel(record.checkInAt);
      const checkOut = record.checkOutAt ? localTimeLabel(record.checkOutAt) : "-";
      const isWorking = !record.checkOutAt;
      const isMissingCheckOut = isWorking && record.date !== localDateKey(now);
      const minutes = isWorking ? 0 : loggedMinutes(record, now, settings);
      const isComplete = minutes >= record.targetMinutes;

      return {
        date: record.date,
        day,
        weekday: weekdayLabel(record.date),
        time: `${checkIn} -> ${checkOut}`,
        total: isWorking ? "-" : formatDuration(minutes),
        badge: isMissingCheckOut ? "Missing" : isWorking ? "Working" : isComplete ? "Full" : "Short",
        tone: isWorking ? (isMissingCheckOut ? "danger" : "warning") : isComplete ? "success" : "danger"
      };
    });
}
