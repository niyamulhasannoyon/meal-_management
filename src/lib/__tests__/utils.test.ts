import { describe, it, expect } from "vitest";
import { getMonthStr, getDateStr } from "../utils";

describe("getMonthStr", () => {
  it("formats standard YYYY-MM-DD strings correctly", () => {
    expect(getMonthStr("2026-07-15")).toBe("2026-07");
  });

  it("handles standard YYYY-MM strings", () => {
    expect(getMonthStr("2026-07")).toBe("2026-07");
  });

  it("pads single-digit month strings correctly", () => {
    expect(getMonthStr("2026-7-5")).toBe("2026-07");
    expect(getMonthStr("2026-7")).toBe("2026-07");
  });

  it("handles Firestore Timestamp objects with toDate()", () => {
    const mockTimestamp = {
      toDate: () => new Date(2026, 6, 15), // Month is 0-indexed: 6 = July
    };
    expect(getMonthStr(mockTimestamp)).toBe("2026-07");
  });

  it("handles serialized Firestore Timestamp objects with seconds property", () => {
    const mockSeconds = {
      seconds: 1784073600, // July 15, 2026 UTC approx
    };
    const res = getMonthStr(mockSeconds);
    expect(res).toMatch(/^2026-07/);
  });

  it("handles Date objects", () => {
    const d = new Date(2026, 6, 1);
    expect(getMonthStr(d)).toBe("2026-07");
  });

  it("returns empty string for null, undefined, or empty values", () => {
    expect(getMonthStr(null)).toBe("");
    expect(getMonthStr(undefined)).toBe("");
    expect(getMonthStr("")).toBe("");
  });
});

describe("getDateStr", () => {
  it("formats standard YYYY-MM-DD strings correctly", () => {
    expect(getDateStr("2026-07-15")).toBe("2026-07-15");
  });

  it("pads single-digit month/day strings correctly", () => {
    expect(getDateStr("2026-7-5")).toBe("2026-07-05");
  });

  it("handles Firestore Timestamp objects with toDate()", () => {
    const mockTimestamp = {
      toDate: () => new Date(2026, 6, 15),
    };
    expect(getDateStr(mockTimestamp)).toBe("2026-07-15");
  });

  it("returns empty string for null, undefined, or empty values", () => {
    expect(getDateStr(null)).toBe("");
    expect(getDateStr(undefined)).toBe("");
    expect(getDateStr("")).toBe("");
  });
});
