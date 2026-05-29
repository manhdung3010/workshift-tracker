import type { ShiftStatus, WorkdayRecord } from "../types/workshift";

export function elapsedMinutes(record: WorkdayRecord, now: Date): number {
  if (!record.checkInAt) {
    return 0;
  }

  const start = new Date(record.checkInAt).getTime();
  const end = record.checkOutAt ? new Date(record.checkOutAt).getTime() : now.getTime();
  const elapsedMs = Math.max(0, end - start);

  return Math.floor(elapsedMs / 60_000);
}

export function shiftStatus(
  record: WorkdayRecord | undefined,
  now: Date
): ShiftStatus {
  if (!record?.checkInAt) {
    return "not_started";
  }

  if (record.checkOutAt) {
    return "checked_out";
  }

  if (elapsedMinutes(record, now) >= record.targetMinutes) {
    return "completed";
  }

  return "working";
}

export function progressRatio(
  record: WorkdayRecord | undefined,
  now: Date
): number {
  if (!record || record.targetMinutes <= 0) {
    return 0;
  }

  return Math.min(1, elapsedMinutes(record, now) / record.targetMinutes);
}

export function formatDuration(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  return `${hours}h${remainingMinutes.toString().padStart(2, "0")}`;
}
