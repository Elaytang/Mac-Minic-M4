import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  shell,
} from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CoreManager } from "./core-manager.mjs";
import { readLocalConfig } from "./config-reader.mjs";
import { SettingsStore } from "./settings-store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged && process.env.NODE_ENV !== "production" && process.env.ELECTRON_SERVE_DIST !== "1";
let mainWindow = null;
let tray = null;
let isQuitting = false;
let stopPromise = null;
let settingsStore = null;
let rendererReady = false;

app.setName("Tangline");
app.setAboutPanelOptions({
  applicationName: "Tangline",
  applicationVersion: app.getVersion(),
  copyright: "A quiet local network console.",
  version: app.getVersion(),
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

const iconPath = (name) => path.join(__dirname, "..", "assets", name);

function icon(name) {
  const file = iconPath(name);
  if (!fs.existsSync(file)) return nativeImage.createEmpty();
  const image = nativeImage.createFromPath(file);
  if (name.startsWith("tray") && process.platform === "darwin") {
    image.setTemplateImage(true);
  }
  return image;
}

const core = new CoreManager({
  onEvent: (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("core:event", event);
    }
    if (
      [
        "core-started",
        "core-stopped",
        "system-proxy-changed",
        "system-proxy-error",
      ].includes(event.type)
    ) {
      updateTray();
    }
    if (event.type === "system-proxy-changed" && settingsStore) {
      settingsStore.update({
        proxyOwnership:
          event.enabled && event.managedBy === "tangline"
            ? {
                enabled: true,
                service: event.service,
                server: "127.0.0.1",
                port: event.endpoint?.port,
                enabledAt: event.at,
              }
            : null,
      });
    }
  },
});

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  mainWindow.show();
  mainWindow.focus();
}

function navigate(page) {
  showWindow();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (rendererReady) {
    mainWindow.webContents.send("app:navigate", page);
  } else {
    mainWindow.webContents.once("did-finish-load", () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("app:navigate", page);
      }
    });
  }
}

function createApplicationMenu() {
  const template = [
    {
      label: "Tangline",
      submenu: [
        { role: "about", label: "关于 Tangline" },
        { type: "separator" },
        {
          label: "设置…",
          accelerator: "CmdOrCtrl+,",
          click: () => navigate("settings"),
        },
        { type: "separator" },
        { role: "services", label: "服务" },
        { type: "separator" },
        { role: "hide", label: "隐藏 Tangline" },
        { role: "hideOthers", label: "隐藏其他" },
        { role: "unhide", label: "全部显示" },
        { type: "separator" },
        {
          label: "退出 Tangline",
          accelerator: "CmdOrCtrl+Q",
          click: () => app.quit(),
        },
      ],
    },
    {
      label: "显示",
      submenu: [
        {
          label: "总览",
          accelerator: "CmdOrCtrl+1",
          click: () => navigate("overview"),
        },
        {
          label: "节点",
          accelerator: "CmdOrCtrl+2",
          click: () => navigate("nodes"),
        },
        {
          label: "订阅",
          accelerator: "CmdOrCtrl+3",
          click: () => navigate("subscriptions"),
        },
        {
          label: "路由规则",
          accelerator: "CmdOrCtrl+4",
          click: () => navigate("rules"),
        },
        {
          label: "连接",
          accelerator: "CmdOrCtrl+5",
          click: () => navigate("connections"),
        },
        {
          label: "日志",
          accelerator: "CmdOrCtrl+6",
          click: () => navigate("logs"),
        },
        { type: "separator" },
        {
          label: "重新读取配置",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            showWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send("app:refresh");
            }
          },
        },
        { type: "separator" },
        { role: "togglefullscreen", label: "进入全屏幕" },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "拷贝" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ],
    },
    {
      label: "窗口",
      submenu: [
        { role: "minimize", label: "最小化" },
        { role: "zoom", label: "缩放" },
        { type: "separator" },
        {
          label: "显示主窗口",
          accelerator: "CmdOrCtrl+Shift+0",
          click: showWindow,
        },
        { type: "separator" },
        { role: "front", label: "前置全部窗口" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function updateTray() {
  if (!tray) return;
  const running = core.status.running;
  tray.setToolTip(running ? "Tangline · 已连接" : "Tangline · 未连接");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "显示 Tangline",
        click: showWindow,
      },
      { type: "separator" },
      {
        label: running ? "断开连接" : "启动连接",
        click: async () => {
          if (core.status.running) {
            await core.stop();
          } else {
            await startCoreWithLocalConfig();
          }
        },
      },
      {
        label: running ? "mihomo 运行中" : "mihomo 未启动",
        enabled: false,
      },
      { type: "separator" },
      {
        label: "退出 Tangline",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
}

function createTray() {
  if (tray) return;
  const image = icon("trayTemplate.png");
  if (image.isEmpty()) return;
  tray = new Tray(image);
  tray.on("click", showWindow);
  updateTray();
}

async function startCoreWithLocalConfig(options = {}) {
  if (core.status.running) {
    return { ok: true, alreadyRunning: true, status: core.status };
  }
  const local = readLocalConfig();
  const settings = local?.config?.settings || {};
  return core.start({
    profilePath: options.profilePath || local?.config?.profilePath,
    mixedPort: options.mixedPort ?? settings.mixedPort,
    controllerPort: options.controllerPort ?? settings.controlPort,
    secret: options.secret ?? "",
    defaultNode: options.defaultNode ?? null,
    tun: options.tun ?? Boolean(settingsStore?.get()?.tunEnabled),
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 760,
    minHeight: 620,
    title: "Tangline",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    vibrancy: "under-window",
    visualEffectState: "active",
    backgroundColor: "#00000000",
    hasShadow: true,
    show: false,
    icon: icon("tangline-icon-1024.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.on("did-finish-load", () => {
    rendererReady = true;
  });
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });
  mainWindow.on("closed", () => {
    rendererReady = false;
    mainWindow = null;
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  if (isDev) {
    mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  settingsStore = new SettingsStore(
    path.join(app.getPath("userData"), "settings.json"),
  );
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(icon("tangline-icon-1024.png"));
  }
  createApplicationMenu();
  createWindow();
  createTray();
  app.on("activate", () => {
    showWindow();
  });
});

app.on("second-instance", () => {
  showWindow();
});

app.on("window-all-closed", () => {
  // Tangline stays available from the macOS menu bar.
});

app.on("before-quit", (event) => {
  if (isQuitting && !core.status.running) return;
  event.preventDefault();
  isQuitting = true;
  if (!stopPromise) {
    stopPromise = core.stop().finally(() => {
      stopPromise = null;
      app.quit();
    });
  }
});

ipcMain.handle("bootstrap", async () => {
  const local = readLocalConfig();
  const settings = settingsStore?.get() || {
    autoConnect: false,
    favorites: [],
    recent: [],
    proxyOwnership: null,
  };
  await core.refreshSystemProxyStatus({
    expectedPort: local?.config?.settings?.mixedPort,
    ownership: settings.proxyOwnership,
  });
  const coreStatus = core.status;
  const loginItem = app.getLoginItemSettings();
  return {
    local,
    core: coreStatus,
    settings,
    app: {
      version: app.getVersion(),
      platform: process.platform,
      electron: process.versions.electron,
      launchAtLogin: Boolean(loginItem.openAtLogin),
    },
  };
});

ipcMain.handle("local-data:refresh", () => readLocalConfig());
ipcMain.handle("settings:update", (_event, patch) => {
  if (!settingsStore) throw new Error("设置尚未初始化");
  return settingsStore.update(patch);
});
ipcMain.handle("core:start", (_event, options) => startCoreWithLocalConfig(options));
ipcMain.handle("core:stop", () => core.stop());
ipcMain.handle("core:status", () => core.status);
ipcMain.handle("core:traffic", () => core.traffic());
ipcMain.handle("core:connections", () => core.connections());
ipcMain.handle("core:logs", () => core.logs);
ipcMain.handle("core:clear-logs", () => core.clearLogs());
ipcMain.handle("core:select-proxy", (_event, { group, proxy }) =>
  core.selectProxy(group, proxy),
);
ipcMain.handle("core:select-node", (_event, node) => core.selectNode(node));
ipcMain.handle("core:current-selection", () => core.currentSelection());
ipcMain.handle("core:test-delay", (_event, proxy) => core.testDelay(proxy));
ipcMain.handle("core:set-mode", (_event, mode) => core.setMode(mode));
ipcMain.handle("system-proxy:set", (_event, enabled) =>
  core.setSystemProxy(enabled),
);
ipcMain.handle("system-proxy:refresh", (_event, expectedPort) =>
  core.refreshSystemProxyStatus({
    expectedPort,
    ownership: settingsStore?.get()?.proxyOwnership,
  }),
);
ipcMain.handle("app:launch-at-login", (_event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
  return { ok: true, enabled: Boolean(enabled) };
});
ipcMain.handle("app:show-window", () => {
  showWindow();
  return { ok: true };
});
ipcMain.handle("app:quit", () => {
  app.quit();
  return { ok: true };
});
ipcMain.handle("app:open-external", (_event, url) => {
  if (/^https?:\/\//.test(url)) return shell.openExternal(url);
  return null;
});
