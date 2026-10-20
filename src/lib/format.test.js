import { describe, expect, it } from "vitest";
import { delayTone, formatBytes, formatRate, formatUptime } from "./format.js";

describe("format utilities", () => {
  it("formats byte values with stable units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(1024 * 1024 * 5.5)).toBe("5.50 MB");
  });

  it("formats rates and uptime", () => {
    expect(formatRate(2048)).toBe("2.00 KB/s");
    expect(formatUptime(125000)).toBe("02:05");
    expect(formatUptime(3665000)).toBe("01:01");
  });

  it("maps delay values to tones", () => {
    expect(delayTone(null)).toBe("unknown");
    expect(delayTone(45)).toBe("fast");
    expect(delayTone(120)).toBe("medium");
    expect(delayTone(300)).toBe("slow");
  });
});
