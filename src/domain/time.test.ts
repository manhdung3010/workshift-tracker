import { describe, expect, it } from "vitest";
import type { WorkdayRecord } from "../types/workshift";
import {
  elapsedMinutes,
  formatDuration,
  progressRatio,
  shiftStatus
} from "./time";

const now = new Date("2026-05-29T10:30:00.000Z");

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

describe("elapsedMinutes", () => {
  it("returns 0 for a record without check-in", () => {
    expect(elapsedMinutes(record({}), now)).toBe(0);
  });

  it("calculates elapsed time from check-in to now while working", () => {
    expect(
      elapsedMinutes(record({ checkInAt: "2026-05-29T08:00:00.000Z" }), now)
    ).toBe(150);
  });

  it("uses checkout time when the shift is checked out", () => {
    expect(
      elapsedMinutes(
        record({
          checkInAt: "2026-05-29T08:00:00.000Z",
          checkOutAt: "2026-05-29T09:15:00.000Z"
        }),
        now
      )
    ).toBe(75);
  });
});

describe("shiftStatus", () => {
  it("returns not_started when there is no record", () => {
    expect(shiftStatus(undefined, now)).toBe("not_started");
  });

  it("returns working after check-in before target is reached", () => {
    expect(
      shiftStatus(record({ checkInAt: "2026-05-29T08:00:00.000Z" }), now)
    ).toBe("working");
  });

  it("returns completed when elapsed time reaches the target", () => {
    expect(
      shiftStatus(
        record({
          checkInAt: "2026-05-29T08:00:00.000Z",
          targetMinutes: 150
        }),
        now
      )
    ).toBe("completed");
  });

  it("returns checked_out when checkout is recorded", () => {
    expect(
      shiftStatus(
        record({
          checkInAt: "2026-05-29T08:00:00.000Z",
          checkOutAt: "2026-05-29T09:00:00.000Z"
        }),
        now
      )
    ).toBe("checked_out");
  });
});

describe("progressRatio", () => {
  it("caps progress at 1", () => {
    expect(
      progressRatio(
        record({
          checkInAt: "2026-05-29T08:00:00.000Z",
          targetMinutes: 60
        }),
        now
      )
    ).toBe(1);
  });

  it("returns partial progress as a decimal", () => {
    expect(
      progressRatio(
        record({
          checkInAt: "2026-05-29T08:00:00.000Z",
          targetMinutes: 300
        }),
        now
      )
    ).toBe(0.5);
  });
});

describe("formatDuration", () => {
  it("formats hours and minutes", () => {
    expect(formatDuration(390)).toBe("6h30");
  });

  it("formats zero minutes", () => {
    expect(formatDuration(0)).toBe("0h00");
  });
});
