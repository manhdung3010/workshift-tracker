import type { WorkdayRecord } from "../types/workshift";
import { elapsedMinutes } from "./time";

export type WeeklyTotal = {
  weekLabel: string;
  minutes: number;
};

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
  month: string
): number {
  return records
    .filter((record) => isInMonth(record, month))
    .reduce((total, record) => total + elapsedMinutes(record, new Date()), 0);
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
