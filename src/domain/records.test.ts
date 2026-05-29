import { describe, expect, it } from "vitest";
import type { WorkdayRecord } from "../types/workshift";
import {
  dayOffCount,
  missingDays,
  monthlyTotalMinutes,
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

describe("monthlyTotalMinutes", () => {
  it("sums checked work time for the selected month", () => {
    expect(monthlyTotalMinutes(records, "2026-05")).toBe(720);
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
