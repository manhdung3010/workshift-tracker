import type { WorkdayRecord, WorkshiftSettings } from "../types/workshift";

type ReminderInput = {
  settings: WorkshiftSettings;
  todayRecord: WorkdayRecord | undefined;
  now: Date;
  lastReminderAt: Date | undefined;
};

function minutesFromTime(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function localMinutes(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

function dayNumber(now: Date): number {
  return now.getDay();
}

function minutesBetween(startTime: string, endTime: string): number {
  return Math.max(0, minutesFromTime(endTime) - minutesFromTime(startTime));
}

export function effectiveWorkMinutes(settings: WorkshiftSettings): number {
  const workMinutes = minutesBetween(settings.workStartTime, settings.workEndTime);
  const lunchMinutes = minutesBetween(settings.lunchStartTime, settings.lunchEndTime);

  return Math.max(0, workMinutes - lunchMinutes);
}

export function isInLunchBreak(settings: WorkshiftSettings, now: Date): boolean {
  const current = localMinutes(now);
  return (
    current >= minutesFromTime(settings.lunchStartTime) &&
    current < minutesFromTime(settings.lunchEndTime)
  );
}

export function isInWorkingWindow(settings: WorkshiftSettings, now: Date): boolean {
  const current = localMinutes(now);
  return (
    settings.workdays.includes(dayNumber(now)) &&
    current >= minutesFromTime(settings.workStartTime) &&
    current < minutesFromTime(settings.workEndTime) &&
    !isInLunchBreak(settings, now)
  );
}

export function shouldRemindToStart({
  settings,
  todayRecord,
  now,
  lastReminderAt
}: ReminderInput): boolean {
  if (!settings.notifyStartReminder || todayRecord?.checkInAt || todayRecord?.isDayOff) {
    return false;
  }

  if (!isInWorkingWindow(settings, now)) {
    return false;
  }

  if (!lastReminderAt) {
    return true;
  }

  const elapsedMs = now.getTime() - lastReminderAt.getTime();
  return elapsedMs >= settings.startReminderIntervalMinutes * 60_000;
}
