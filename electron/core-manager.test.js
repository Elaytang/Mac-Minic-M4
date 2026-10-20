import { describe, expect, it } from "vitest";
import {
  chooseDirectGroup,
  classifySystemProxy,
  isSelectableProxy,
  proxyOwnershipFromStatus,
} from "./core-manager.mjs";

const localProxy = (port = 3067) => ({
  enabled: true,
  server: "127.0.0.1",
  port,
});

describe("system proxy ownership", () => {
  it("recognizes the proxy endpoint recorded by Tangline", () => {
    const status = classifySystemProxy({
      service: "Wi-Fi",
      web: localProxy(),
      secureWeb: localProxy(),
      socks: localProxy(),
      expectedPort: 3067,
      ownership: {
        enabled: true,
        service: "Wi-Fi",
        server: "127.0.0.1",
        port: 3067,
      },
    });

    expect(status.enabled).toBe(true);
    expect(status.managedBy).toBe("tangline");
    expect(status.endpoint).toMatchObject({
      server: "127.0.0.1",
      port: 3067,
    });
  });

  it("leaves a proxy managed by another application untouched", () => {
    const status = classifySystemProxy({
      service: "Wi-Fi",
      web: { enabled: true, server: "127.0.0.1", port: 8080 },
      secureWeb: { enabled: true, server: "127.0.0.1", port: 8080 },
      socks: { enabled: false, server: "", port: null },
      expectedPort: 3067,
      ownership: {
        enabled: true,
        service: "Wi-Fi",
        server: "127.0.0.1",
        port: 3067,
      },
    });

    expect(status.managedBy).toBe("external");
    expect(status.endpoint.port).toBe(8080);
  });

  it("reports a disabled proxy without inventing ownership", () => {
    const status = classifySystemProxy({
      service: "Wi-Fi",
      web: { enabled: false, server: "", port: null },
      secureWeb: { enabled: false, server: "", port: null },
      socks: { enabled: false, server: "", port: null },
      expectedPort: 3067,
    });

    expect(status.enabled).toBe(false);
    expect(status.available).toBe(true);
    expect(status.managedBy).toBeNull();
  });

  it("only derives ownership from a complete Tangline-managed status", () => {
    expect(
      proxyOwnershipFromStatus({
        enabled: true,
        managedBy: "tangline",
        service: "Wi-Fi",
        endpoint: { server: "127.0.0.1", port: 3067 },
      }),
    ).toEqual({
      enabled: true,
      service: "Wi-Fi",
      server: "127.0.0.1",
      port: 3067,
    });
    expect(
      proxyOwnershipFromStatus({
        enabled: true,
        managedBy: "external",
        service: "Wi-Fi",
        endpoint: { server: "127.0.0.1", port: 3067 },
      }),
    ).toBeNull();
    expect(
      proxyOwnershipFromStatus({
        enabled: false,
        available: false,
        managedBy: null,
      }),
    ).toBeNull();
  });
});

describe("proxy selection", () => {
  it("accepts mihomo's lowercase selector type", () => {
    const proxyMap = {
      entries: [
        {
          name: "🌐 代理",
          type: "selector",
          all: ["🇯🇵 日本01", "🇭🇰 香港01"],
        },
        {
          name: "🌐 代理",
          type: "select",
          all: ["🇯🇵 日本01", "🇭🇰 香港01"],
        },
      ],
      byName: new Map(),
    };

    expect(chooseDirectGroup(proxyMap, "🇯🇵 日本01")).toMatchObject({
      name: "🌐 代理",
      type: "selector",
    });
  });

  it("treats both selectable type spellings consistently", () => {
    expect(isSelectableProxy({ type: "select" })).toBe(true);
    expect(isSelectableProxy({ type: "selector" })).toBe(true);
    expect(isSelectableProxy({ type: "url-test" })).toBe(false);
  });
});
