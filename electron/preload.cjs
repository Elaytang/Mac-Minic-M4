const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tangline", {
  platform: process.platform,
  isElectron: true,
  getBootstrap: () => ipcRenderer.invoke("bootstrap"),
  refreshLocalData: () => ipcRenderer.invoke("local-data:refresh"),
  updateSettings: (patch) => ipcRenderer.invoke("settings:update", patch),
  startCore: (options) => ipcRenderer.invoke("core:start", options),
  stopCore: () => ipcRenderer.invoke("core:stop"),
  getCoreStatus: () => ipcRenderer.invoke("core:status"),
  getTraffic: () => ipcRenderer.invoke("core:traffic"),
  getConnections: () => ipcRenderer.invoke("core:connections"),
  getLogs: () => ipcRenderer.invoke("core:logs"),
  clearLogs: () => ipcRenderer.invoke("core:clear-logs"),
  selectProxy: (group, proxy) =>
    ipcRenderer.invoke("core:select-proxy", { group, proxy }),
  selectNode: (node) => ipcRenderer.invoke("core:select-node", node),
  getCurrentSelection: () => ipcRenderer.invoke("core:current-selection"),
  testDelay: (proxy) => ipcRenderer.invoke("core:test-delay", proxy),
  setMode: (mode) => ipcRenderer.invoke("core:set-mode", mode),
  setSystemProxy: (enabled) =>
    ipcRenderer.invoke("system-proxy:set", enabled),
  refreshSystemProxy: (expectedPort) =>
    ipcRenderer.invoke("system-proxy:refresh", expectedPort),
  setLaunchAtLogin: (enabled) =>
    ipcRenderer.invoke("app:launch-at-login", enabled),
  openExternal: (url) => ipcRenderer.invoke("app:open-external", url),
  showWindow: () => ipcRenderer.invoke("app:show-window"),
  quitApp: () => ipcRenderer.invoke("app:quit"),
  onNavigate: (callback) => {
    const listener = (_event, page) => callback(page);
    ipcRenderer.on("app:navigate", listener);
    return () => ipcRenderer.removeListener("app:navigate", listener);
  },
  onRefresh: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("app:refresh", listener);
    return () => ipcRenderer.removeListener("app:refresh", listener);
  },
  onCoreEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("core:event", listener);
    return () => ipcRenderer.removeListener("core:event", listener);
  },
});
