import { describe, expect, it } from "vitest";
import { isPlaceholderProxyName } from "./proxy-tags.mjs";

describe("placeholder proxy names", () => {
  it("treats subscription metadata as unusable routes", () => {
    expect(isPlaceholderProxyName("剩余流量：1002.95 GB")).toBe(true);
    expect(isPlaceholderProxyName("套餐到期：2026-12-31")).toBe(true);
    expect(isPlaceholderProxyName("官网：example.com")).toBe(true);
  });

  it("keeps real nodes selectable", () => {
    expect(isPlaceholderProxyName("香港 IEPL 01")).toBe(false);
    expect(isPlaceholderProxyName("")).toBe(false);
  });
});
