import { describe, expect, it } from "vitest";
import { applyTunOptions } from "./core-manager.mjs";

describe("TUN runtime options", () => {
  it("enables routing and DNS takeover", () => {
    const config = applyTunOptions(
      { "mixed-port": 7897 },
      { mixedPort: 7899 },
    );

    expect(config.tun).toMatchObject({
      enable: true,
      stack: "gvisor",
      "auto-route": true,
      "auto-detect-interface": true,
      "strict-route": false,
      "dns-hijack": ["any:53"],
    });
    expect(config.dns.enable).toBe(true);
    expect(config["mixed-port"]).toBe(7899);
  });

  it("keeps existing TUN and DNS settings where possible", () => {
    const config = applyTunOptions({
      tun: { stack: "system", mtu: 9000 },
      dns: { listen: "0.0.0.0:1053", "enhanced-mode": "fake-ip" },
    });

    expect(config.tun).toMatchObject({ enable: true, stack: "system", mtu: 9000 });
    expect(config.dns).toMatchObject({
      enable: true,
      listen: "0.0.0.0:1053",
      "enhanced-mode": "fake-ip",
    });
  });
});
