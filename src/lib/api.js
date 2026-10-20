import { demoData } from "./demo-data.js";

const desktop = window.tangline;

export const isDesktop = Boolean(desktop?.isElectron);

export async function getBootstrap() {
  if (!isDesktop) return demoData;
  return desktop.getBootstrap();
}

export async function refreshLocalData() {
  if (!isDesktop) return demoData.local;
  return desktop.refreshLocalData();
}

export async function updateSettings(patch) {
  if (!isDesktop) {
    return {
      ...demoData.settings,
      ...patch,
    };
  }
  return desktop.updateSettings(patch);
}

export async function startCore(options) {
  if (!isDesktop) {
    return {
      ok: false,
      error: "浏览器预览无法启动本地内核，请使用 npm run dev",
    };
  }
  return desktop.startCore(options);
}

export async function stopCore() {
  if (!isDesktop) {
    return {
      ok: false,
      error: "浏览器预览不执行本机操作，请使用 npm run dev",
    };
  }
  return desktop.stopCore();
}

export async function getCoreStatus() {
  if (!isDesktop) return demoData.core;
  return desktop.getCoreStatus();
}

export async function getTraffic() {
  if (!isDesktop) return { up: 0, down: 0 };
  return desktop.getTraffic();
}

export async function getConnections() {
  if (!isDesktop) return { connections: [] };
  return desktop.getConnections();
}

export async function getLogs() {
  if (!isDesktop) {
    return [
      {
        id: "demo-1",
        at: Date.now(),
        line: "预览模式：启动桌面版后读取本地内核日志",
      },
    ];
  }
  return desktop.getLogs();
}

export async function selectProxy(group, proxy) {
  if (!isDesktop) {
    return {
      ok: false,
      error: "浏览器预览不执行本机操作，请使用 npm run dev",
    };
  }
  return desktop.selectProxy(group, proxy);
}

export async function selectNode(node) {
  if (!isDesktop) {
    return {
      ok: false,
      error: "浏览器预览不执行本机操作，请使用 npm run dev",
    };
  }
  return desktop.selectNode(node);
}

export async function getCurrentSelection() {
  if (!isDesktop) return null;
  return desktop.getCurrentSelection();
}

export async function testDelay(proxy) {
  if (!isDesktop) {
    return {
      delay: null,
      error: "浏览器预览不执行本机测速，请使用 npm run dev",
    };
  }
  return desktop.testDelay(proxy);
}

export async function setMode(mode) {
  if (!isDesktop) {
    return {
      ok: false,
      error: "浏览器预览不执行本机操作，请使用 npm run dev",
    };
  }
  return desktop.setMode(mode);
}

export async function setSystemProxy(enabled) {
  if (!isDesktop) {
    return {
      ok: false,
      error: "浏览器预览不执行本机操作，请使用 npm run dev",
    };
  }
  return desktop.setSystemProxy(enabled);
}

export function normalizeSystemProxy(value) {
  const proxy = value && typeof value === "object" ? value : {};
  return {
    enabled: Boolean(proxy.enabled),
    available: proxy.available !== false,
    managedBy:
      proxy.managedBy === "tangline" || proxy.managedBy === "external"
        ? proxy.managedBy
        : null,
    service: typeof proxy.service === "string" ? proxy.service : null,
    endpoint:
      proxy.endpoint && typeof proxy.endpoint === "object"
        ? {
            server: String(proxy.endpoint.server || ""),
            port: Number(proxy.endpoint.port) || null,
            types: Array.isArray(proxy.endpoint.types)
              ? proxy.endpoint.types.filter((type) => typeof type === "string")
              : [],
          }
        : null,
    error: typeof proxy.error === "string" ? proxy.error : null,
  };
}

export async function refreshSystemProxy(expectedPort) {
  if (!isDesktop) {
    return normalizeSystemProxy({
      enabled: false,
      available: true,
      managedBy: null,
      endpoint: null,
    });
  }
  return normalizeSystemProxy(await desktop.refreshSystemProxy(expectedPort));
}

export async function setLaunchAtLogin(enabled) {
  if (!isDesktop) {
    return {
      ok: false,
      error: "浏览器预览不执行本机操作，请使用 npm run dev",
    };
  }
  return desktop.setLaunchAtLogin(enabled);
}

export async function clearLogs() {
  if (!isDesktop) {
    return {
      ok: false,
      error: "浏览器预览不执行本机操作，请使用 npm run dev",
    };
  }
  return desktop.clearLogs();
}

export async function openExternal(url) {
  if (!isDesktop) {
    window.open(url, "_blank", "noopener,noreferrer");
    return null;
  }
  return desktop.openExternal(url);
}

export function onCoreEvent(callback) {
  if (!isDesktop) return () => {};
  return desktop.onCoreEvent(callback);
}

export function onNavigate(callback) {
  if (!isDesktop) return () => {};
  return desktop.onNavigate(callback);
}

export function onRefresh(callback) {
  if (!isDesktop) return () => {};
  return desktop.onRefresh(callback);
}
