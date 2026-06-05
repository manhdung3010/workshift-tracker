import { describe, expect, it } from "vitest";
import type { WorkdayRecord, WorkshiftSettings } from "../types/workshift";
import {
  buildWorkdayRecordFromTimes,
  dayOffCount,
  missingDays,
  monthlyTotalMinutes,
  workdayLogRows,
  weeklyTotals,
  workedDays
} from "./records";

function record(overrides: Partial<WorkdayRecord>): WorkdayRecord {
  return {
    date: "2026-05-01",
    targetMinutes: 480,
    note: "",
    isDayOff: false,
    isOvertime: false,
    ...overrides
  };
}

const records: WorkdayRecord[] = [
  record({
    date: "2026-05-01",
    checkInAt: "2026-05-01T01:00:00.000Z",
    checkOutAt: "2026-05-01T09:00:00.000Z"
  }),
  record({
    date: "2026-05-04",
    checkInAt: "2026-05-04T01:00:00.000Z",
    checkOutAt: "2026-05-04T05:00:00.000Z"
  }),
  record({
    date: "2026-05-05",
    isDayOff: true
  }),
  record({
    date: "2026-06-01",
    checkInAt: "2026-06-01T01:00:00.000Z",
    checkOutAt: "2026-06-01T09:00:00.000Z"
  })
];

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
  lunchEndTime: "13:30",
  workdays: [1, 2, 3, 4, 5]
};

describe("monthlyTotalMinutes", () => {
  it("sums checked work time for the selected month", () => {
    expect(monthlyTotalMinutes(records, "2026-05")).toBe(720);
  });

  it("subtracts lunch time when schedule settings are provided", () => {
    expect(
      monthlyTotalMinutes(
        [
          record({
            date: "2026-06-03",
            checkInAt: new Date(2026, 5, 3, 8, 20).toISOString(),
            checkOutAt: new Date(2026, 5, 3, 17, 50).toISOString()
          })
        ],
        "2026-06",
        new Date(2026, 5, 3, 17, 50),
        settings
      )
    ).toBe(480);
  });

  it("does not count records that are missing check-out time", () => {
    expect(
      monthlyTotalMinutes(
        [
          record({
            date: "2026-06-04",
            checkInAt: new Date(2026, 5, 4, 8, 6).toISOString()
          }),
          record({
            date: "2026-06-03",
            checkInAt: new Date(2026, 5, 3, 8, 20).toISOString(),
            checkOutAt: new Date(2026, 5, 3, 17, 50).toISOString()
          })
        ],
        "2026-06",
        new Date(2026, 5, 4, 17, 23),
        settings
      )
    ).toBe(480);
  });
});

describe("workedDays", () => {
  it("counts days with a check-in in the selected month", () => {
    expect(workedDays(records, "2026-05")).toBe(2);
  });
});

describe("dayOffCount", () => {
  it("counts day-off records in the selected month", () => {
    expect(dayOffCount(records, "2026-05")).toBe(1);
  });
});

describe("missingDays", () => {
  it("returns short work days and excludes days off", () => {
    expect(missingDays(records, "2026-05", new Date("2026-05-06T00:00:00.000Z"))).toEqual([
      records[1]
    ]);
  });
});

describe("weeklyTotals", () => {
  it("groups monthly work time by week of month", () => {
    expect(weeklyTotals(records, "2026-05")).toEqual([
      { weekLabel: "Tuần 1", minutes: 480 },
      { weekLabel: "Tuần 2", minutes: 240 }
    ]);
  });
});

describe("workdayLogRows", () => {
  it("formats saved records for the selected month newest first", () => {
    expect(
      workdayLogRows(
        [
          ...records,
          record({
            date: "2026-05-06",
            checkInAt: "2026-05-06T01:30:00.000Z"
          })
        ],
        "2026-05",
        new Date("2026-05-06T03:00:00.000Z")
      )
    ).toEqual([
      {
        date: "2026-05-06",
        day: "06",
        weekday: "Wed",
        time: "08:30 -> -",
        total: "-",
        badge: "Working",
        tone: "warning"
      },
      {
        date: "2026-05-05",
        day: "05",
        weekday: "Tue",
        time: "Day off",
        total: "-",
        badge: "Day off",
        tone: "muted"
      },
      {
        date: "2026-05-04",
        day: "04",
        weekday: "Mon",
        time: "08:00 -> 12:00",
        total: "4h00",
        badge: "Short",
        tone: "danger"
      },
      {
        date: "2026-05-01",
        day: "01",
        weekday: "Fri",
        time: "08:00 -> 16:00",
        total: "8h00",
        badge: "Full",
        tone: "success"
      }
    ]);
  });

  it("subtracts lunch time and marks old missing check-out records", () => {
    expect(
      workdayLogRows(
        [
          record({
            date: "2026-06-04",
            checkInAt: new Date(2026, 5, 4, 8, 6).toISOString()
          }),
          record({
            date: "2026-06-03",
            checkInAt: new Date(2026, 5, 3, 8, 20).toISOString(),
            checkOutAt: new Date(2026, 5, 3, 17, 50).toISOString()
          }),
          record({
            date: "2026-06-02",
            checkInAt: new Date(2026, 5, 2, 8, 20).toISOString()
          })
        ],
        "2026-06",
        new Date(2026, 5, 4, 17, 23),
        settings
      )
    ).toEqual([
      {
        date: "2026-06-04",
        day: "04",
        weekday: "Thu",
        time: "08:06 -> -",
        total: "-",
        badge: "Working",
        tone: "warning"
      },
      {
        date: "2026-06-03",
        day: "03",
        weekday: "Wed",
        time: "08:20 -> 17:50",
        total: "8h00",
        badge: "Full",
        tone: "success"
      },
      {
        date: "2026-06-02",
        day: "02",
        weekday: "Tue",
        time: "08:20 -> -",
        total: "-",
        badge: "Missing",
        tone: "danger"
      }
    ]);
  });
});

describe("buildWorkdayRecordFromTimes", () => {
  it("creates a new workday record from a date key and local times", () => {
    expect(
      buildWorkdayRecordFromTimes({
        date: "2026-05-07",
        checkInTime: "08:30",
        checkOutTime: "17:30",
        targetMinutes: 480
      })
    ).toEqual({
      date: "2026-05-07",
      checkInAt: new Date(2026, 4, 7, 8, 30).toISOString(),
      checkOutAt: new Date(2026, 4, 7, 17, 30).toISOString(),
      targetMinutes: 480,
      note: "",
      isDayOff: false,
      isOvertime: false
    });
  });

  it("allows an empty check-out time for forgotten check-out records", () => {
    expect(
      buildWorkdayRecordFromTimes({
        existing: record({
          date: "2026-05-07",
          checkOutAt: new Date(2026, 4, 7, 17, 30).toISOString()
        }),
        date: "2026-05-07",
        checkInTime: "08:30",
        checkOutTime: "",
        targetMinutes: 480
      })
    ).toMatchObject({
      date: "2026-05-07",
      checkInAt: new Date(2026, 4, 7, 8, 30).toISOString(),
      checkOutAt: undefined
    });
  });

  it("updates times without dropping existing record metadata", () => {
    expect(
      buildWorkdayRecordFromTimes({
        existing: record({
          date: "2026-05-07",
          note: "Remote",
          isOvertime: true
        }),
        date: "2026-05-07",
        checkInTime: "09:00",
        checkOutTime: "18:00",
        targetMinutes: 450
      })
    ).toMatchObject({
      date: "2026-05-07",
      note: "Remote",
      isOvertime: true,
      targetMinutes: 480,
      checkInAt: new Date(2026, 4, 7, 9, 0).toISOString(),
      checkOutAt: new Date(2026, 4, 7, 18, 0).toISOString()
    });
  });
});
