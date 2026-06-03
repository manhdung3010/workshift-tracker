import { describe, expect, it } from "vitest";
import type { WorkdayRecord, WorkshiftSettings } from "../types/workshift";
import {
  effectiveWorkMinutes,
  estimatedShiftEndTime,
  isInLunchBreak,
  progressRatioWithSchedule,
  remainingShiftMinutes,
  shiftStatusWithSchedule,
  shouldRemindToStart
} from "./schedule";

const settings: WorkshiftSettings = {
  targetMinutes: 480,
  startAtLogin: true,
  showWidget: true,
  notifyOnComplete: true,
  notifyStartReminder: true,
  startReminderIntervalMinutes: 5,
  workStartTime: "09:00",
  workEndTime: "18:00",
  lunchStartTime: "12:00",
  lunchEndTime: "13:00",
  workdays: [1, 2, 3, 4, 5]
};

function record(overrides: Partial<WorkdayRecord>): WorkdayRecord {
  return {
    date: "2026-05-29",
    targetMinutes: 480,
    note: "",
    isDayOff: false,
    isOvertime: false,
    ...overrides
  };
}

describe("effectiveWorkMinutes", () => {
  it("subtracts lunch time from the configured work window", () => {
    expect(effectiveWorkMinutes(settings)).toBe(480);
  });
});

describe("estimatedShiftEndTime", () => {
  it("adds lunch time when the required work period crosses lunch", () => {
    expect(
      estimatedShiftEndTime({
        settings,
        checkInAt: new Date(2026, 4, 29, 9, 0),
        targetMinutes: 480
      })
    ).toEqual(new Date(2026, 4, 29, 18, 0));
  });

  it("resumes work after lunch when the target would end inside lunch", () => {
    expect(
      estimatedShiftEndTime({
        settings,
        checkInAt: new Date(2026, 4, 29, 9, 0),
        targetMinutes: 181
      })
    ).toEqual(new Date(2026, 4, 29, 13, 1));
  });
});

describe("remainingShiftMinutes", () => {
  it("includes upcoming lunch time in the remaining wall-clock time", () => {
    expect(
      remainingShiftMinutes({
        settings,
        checkInAt: new Date(2026, 4, 29, 9, 0),
        targetMinutes: 480,
        now: new Date(2026, 4, 29, 10, 0)
      })
    ).toBe(480);
  });

  it("does not include lunch time after lunch has passed", () => {
    expect(
      remainingShiftMinutes({
        settings,
        checkInAt: new Date(2026, 4, 29, 9, 0),
        targetMinutes: 480,
        now: new Date(2026, 4, 29, 14, 0)
      })
    ).toBe(240);
  });
});

describe("shiftStatusWithSchedule", () => {
  it("does not complete until lunch-aware end time is reached", () => {
    const workday = record({
      checkInAt: new Date(2026, 4, 29, 9, 0).toISOString(),
      targetMinutes: 480
    });

    expect(shiftStatusWithSchedule(workday, settings, new Date(2026, 4, 29, 17, 0))).toBe(
      "working"
    );
    expect(shiftStatusWithSchedule(workday, settings, new Date(2026, 4, 29, 18, 0))).toBe(
      "completed"
    );
  });
});

describe("progressRatioWithSchedule", () => {
  it("keeps progress below 100 percent before lunch-aware end time", () => {
    const workday = record({
      checkInAt: new Date(2026, 4, 29, 9, 0).toISOString(),
      targetMinutes: 480
    });

    expect(progressRatioWithSchedule(workday, settings, new Date(2026, 4, 29, 17, 0))).toBe(
      7 / 8
    );
    expect(progressRatioWithSchedule(workday, settings, new Date(2026, 4, 29, 18, 0))).toBe(1);
  });
});

describe("isInLunchBreak", () => {
  it("detects time inside the configured lunch break", () => {
    expect(isInLunchBreak(settings, new Date("2026-05-29T05:30:00.000Z"))).toBe(true);
    expect(isInLunchBreak(settings, new Date("2026-05-29T04:30:00.000Z"))).toBe(false);
  });
});

describe("shouldRemindToStart", () => {
  it("reminds during working time when today has not started", () => {
    expect(
      shouldRemindToStart({
        settings,
        todayRecord: undefined,
        now: new Date("2026-05-29T02:15:00.000Z"),
        lastReminderAt: undefined
      })
    ).toBe(true);
  });

  it("does not remind during lunch, outside workdays, or after start", () => {
    expect(
      shouldRemindToStart({
        settings,
        todayRecord: undefined,
        now: new Date("2026-05-29T05:15:00.000Z"),
        lastReminderAt: undefined
      })
    ).toBe(false);

    expect(
      shouldRemindToStart({
        settings,
        todayRecord: undefined,
        now: new Date("2026-05-30T02:15:00.000Z"),
        lastReminderAt: undefined
      })
    ).toBe(false);

    expect(
      shouldRemindToStart({
        settings,
        todayRecord: record({ checkInAt: "2026-05-29T02:00:00.000Z" }),
        now: new Date("2026-05-29T02:15:00.000Z"),
        lastReminderAt: undefined
      })
    ).toBe(false);
  });

  it("waits for the configured interval before reminding again", () => {
    expect(
      shouldRemindToStart({
        settings,
        todayRecord: undefined,
        now: new Date("2026-05-29T02:04:59.000Z"),
        lastReminderAt: new Date("2026-05-29T02:00:00.000Z")
      })
    ).toBe(false);

    expect(
      shouldRemindToStart({
        settings,
        todayRecord: undefined,
        now: new Date("2026-05-29T02:05:00.000Z"),
        lastReminderAt: new Date("2026-05-29T02:00:00.000Z")
      })
    ).toBe(true);
  });
});
