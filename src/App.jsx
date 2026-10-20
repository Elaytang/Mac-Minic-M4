import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Menu, RefreshCw } from "lucide-react";
import Sidebar from "./components/Sidebar.jsx";
import Toast from "./components/Toast.jsx";
import Overview from "./pages/Overview.jsx";
import Nodes from "./pages/Nodes.jsx";
import Subscriptions from "./pages/Subscriptions.jsx";
import Rules from "./pages/Rules.jsx";
import Connections from "./pages/Connections.jsx";
import Logs from "./pages/Logs.jsx";
import Settings from "./pages/Settings.jsx";
import {
  clearLogs,
  getBootstrap,
  getConnections,
  getCurrentSelection,
  getLogs,
  getTraffic,
  isDesktop,
  normalizeSystemProxy,
  onCoreEvent,
  onNavigate,
  onRefresh,
  refreshSystemProxy,
  refreshLocalData,
  selectNode,
  setLaunchAtLogin,
  setMode,
  setSystemProxy,
  startCore,
  stopCore,
  testDelay,
  updateSettings,
} from "./lib/api.js";
import { demoData } from "./lib/demo-data.js";

const pageMeta = {
  overview: "总览",
  nodes: "节点",
  subscriptions: "订阅",
  rules: "路由规则",
  connections: "连接",
  logs: "日志",
  settings: "设置",
};
const pageIds = new Set(Object.keys(pageMeta));

export default function App() {
  const [page, setPage] = useState("overview");
  const [local, setLocal] = useState(demoData.local);
  const [core, setCore] = useState(demoData.core);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [traffic, setTraffic] = useState({ up: 0, down: 0 });
  const [trafficHistory, setTrafficHistory] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [recent, setRecent] = useState([]);
  const [logs, setLogs] = useState([]);
  const [connections, setConnections] = useState([]);
  const [systemProxy, setSystemProxyState] = useState(() =>
    normalizeSystemProxy(demoData.core.systemProxy),
  );
  const [launchAtLogin, setLaunchAtLoginState] = useState(false);
  const [autoConnect, setAutoConnectState] = useState(false);
  const [tunEnabled, setTunEnabledState] = useState(false);
  const [tunBusy, setTunBusy] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [mode, setModeState] = useState("rule");
  const [testingId, setTestingId] = useState(null);
  const [testingAll, setTestingAll] = useState(false);
  const [toast, setToast] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [connectionsRefreshing, setConnectionsRefreshing] = useState(false);
  const toastTimer = useRef(null);
  const autoConnectAttempted = useRef(false);
  const menuButtonRef = useRef(null);

  const notify = useCallback((message, tone = "info") => {
    setToast({ message, tone });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 5200);
  }, []);

  const config = local.config || demoData.local.config;
  const selectedNode = useMemo(
    () =>
      config.nodes.find((node) => node.id === selectedNodeId) ||
      config.nodes.find((node) => node.delay) ||
      config.nodes[0] ||
      null,
    [config.nodes, selectedNodeId],
  );

  useEffect(() => {
    let cancelled = false;
    getBootstrap()
      .then((data) => {
        if (cancelled) return;
        setLocal(data.local);
        setCore(data.core);
        setSystemProxyState(normalizeSystemProxy(data.core?.systemProxy));
        setLaunchAtLoginState(Boolean(data.app?.launchAtLogin));
        setAutoConnectState(Boolean(data.settings?.autoConnect));
        setTunEnabledState(Boolean(data.settings?.tunEnabled));
        setModeState(data.core?.mode || "rule");
        setSelectedNodeId(data.local?.config?.nodes?.[0]?.id || null);
        setFavorites(data.settings?.favorites || data.local?.config?.favorites || []);
        setRecent(data.settings?.recent || data.local?.config?.recent || []);
        setSettingsReady(true);
      })
      .catch((error) => notify(`读取本机配置失败：${error.message}`, "error"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [notify]);

  useEffect(() => {
    if (!isDesktop) return undefined;
    return onCoreEvent((event) => {
      if (event.type === "core-started") {
        setCore((previous) => ({ ...previous, running: true, ...event }));
        if (event.systemProxy) {
          setSystemProxyState(normalizeSystemProxy(event.systemProxy));
        }
        if (event.mode) setModeState(event.mode);
      }
      if (event.type === "core-stopped") {
        setCore((previous) => ({
          ...previous,
          running: false,
          systemProxy: event.systemProxy || previous.systemProxy,
        }));
        if (event.systemProxy) {
          setSystemProxyState(normalizeSystemProxy(event.systemProxy));
        }
        setStarting(false);
      }
      if (event.type === "log") {
        setLogs((previous) => [...previous.slice(-499), event]);
      }
      if (event.type === "proxy-selected") {
        setRecent((previous) => {
          const next = [event.proxy, ...previous.filter((name) => name !== event.proxy)].slice(0, 8);
          updateSettings({ recent: next }).catch(() => {});
          return next;
        });
      }
      if (event.type === "logs-cleared") setLogs([]);
      if (event.type === "system-proxy-changed") {
        setSystemProxyState(normalizeSystemProxy(event));
      }
      if (event.type === "system-proxy-error") {
        notify(`系统代理未能自动关闭：${event.error}`, "error");
      }
    });
  }, [notify]);

  useEffect(() => {
    if (!core.running) {
      setElapsed(0);
      return undefined;
    }
    const started = core.startedAt || Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => window.clearInterval(timer);
  }, [core.running, core.startedAt]);

  useEffect(() => {
    if (!core.running) {
      setTraffic({ up: 0, down: 0 });
      return undefined;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const value = await getTraffic();
        if (cancelled) return;
        setTraffic({ up: value?.up || 0, down: value?.down || 0 });
        setTrafficHistory((previous) => [
          ...previous.slice(-59),
          (value?.down || 0) + (value?.up || 0),
        ]);
      } catch {
        // A transient API failure should not replace the connection UI with an error.
      }
    };
    poll();
    const timer = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [core.running]);

  useEffect(() => {
    if (!core.running) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const value = await getConnections();
        if (!cancelled) setConnections(value?.connections || []);
      } catch {
        // Keep the last known list when the controller is restarting.
      }
    };
    poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [core.running]);

  useEffect(() => {
    getLogs().then(setLogs).catch(() => {});
  }, []);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "1") {
        event.preventDefault();
        setPage("overview");
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "2") {
        event.preventDefault();
        setPage("nodes");
      }
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        setPage("settings");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!sidebarOpen || window.matchMedia("(min-width: 881px)").matches) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  const bootAutoConnect = useCallback(async () => {
    if (!isDesktop || autoConnectAttempted.current || core.running) return;
    autoConnectAttempted.current = true;
    setStarting(true);
    try {
      const result = await startCore({ defaultNode: selectedNode?.tag || null });
      if (!result.ok) {
        notify(result.error || "自动连接失败", "error");
        return;
      }
      setCore(result.status);
      if (result.status?.systemProxy) {
        setSystemProxyState(normalizeSystemProxy(result.status.systemProxy));
      }
      notify("本地内核已按设置启动", "success");
    } catch (error) {
      notify(`自动连接失败：${error.message}`, "error");
    } finally {
      setStarting(false);
    }
  }, [core.running, notify, selectedNode?.tag]);

  const syncCurrentSelection = useCallback(
    async (nodes = config.nodes) => {
      if (!isDesktop || !core.running) return;
      const selection = await getCurrentSelection();
      const nodeId = nodes.find((node) => node.tag === selection?.tag)?.id;
      if (nodeId) setSelectedNodeId(nodeId);
    },
    [config.nodes, core.running],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await refreshLocalData();
      setLocal(data);
      await syncCurrentSelection(data.config?.nodes || []);
      notify("已重新读取本机配置", "success");
    } catch (error) {
      notify(`刷新失败：${error.message}`, "error");
    } finally {
      setRefreshing(false);
    }
  }, [notify, syncCurrentSelection]);

  useEffect(() => {
    return onNavigate((nextPage) => {
      if (!pageIds.has(nextPage)) return;
      setPage(nextPage);
      setSidebarOpen(false);
    });
  }, []);

  useEffect(() => {
    return onRefresh(() => {
      refresh();
    });
  }, [refresh]);

  const toggleConnection = useCallback(async () => {
    if (starting) return;
    if (core.running) {
      setStarting(true);
      try {
        const result = await stopCore();
        const stoppedStatus = result.status || {};
        setCore((previous) => {
          const nextProxy = stoppedStatus.systemProxy || previous.systemProxy;
          return {
            ...previous,
            ...stoppedStatus,
            running: false,
            systemProxy: nextProxy,
          };
        });
        if (stoppedStatus.systemProxy) {
          setSystemProxyState(normalizeSystemProxy(stoppedStatus.systemProxy));
        }
        if (!result.ok) {
          const externalProxy =
            stoppedStatus.systemProxy?.managedBy === "external";
          const proxyUnavailable =
            stoppedStatus.systemProxy?.available === false;
          notify(
            result.warning ||
              result.error ||
              (proxyUnavailable
                ? "无法读取系统代理状态，Tangline 未做修改"
                : externalProxy
                  ? "其他应用管理的系统代理保持开启"
                  : "内核已停止，但系统代理未能关闭"),
            externalProxy || proxyUnavailable ? "info" : "error",
          );
        } else {
          notify("已断开本地内核", "info");
        }
      } catch (error) {
        notify(`断开失败：${error.message}`, "error");
      } finally {
        setStarting(false);
      }
      return;
    }
    setStarting(true);
    try {
      const result = await startCore({
        profilePath: config.profilePath,
        defaultNode: selectedNode?.tag || null,
      });
      if (!result.ok) {
        notify(result.error || "内核启动失败", "error");
        setCore((previous) => ({ ...previous, error: result.error }));
        return;
      }
      setCore(result.status);
      if (result.status?.systemProxy) {
        setSystemProxyState(normalizeSystemProxy(result.status.systemProxy));
      }
      notify("本地内核已启动", "success");
    } catch (error) {
      notify(`启动失败：${error.message}`, "error");
    } finally {
      setStarting(false);
    }
  }, [
    config.profilePath,
    core.running,
    notify,
    selectedNode?.tag,
    starting,
  ]);

  const testOne = useCallback(
    async (node) => {
      setTestingId(node.id);
      try {
        const result = await testDelay(node.tag);
        if (!result.delay) throw new Error("未返回延迟");
        setLocal((previous) => ({
          ...previous,
          config: {
            ...previous.config,
            nodes: previous.config.nodes.map((item) =>
              item.id === node.id ? { ...item, delay: result.delay } : item,
            ),
          },
        }));
        notify(`${node.name} · ${result.delay} ms`, "success");
      } catch (error) {
        notify(`测速失败：${error.message}`, "error");
      } finally {
        setTestingId(null);
      }
    },
    [notify],
  );

  const testAll = useCallback(
    async (nodes) => {
      if (!nodes.length) return;
      setTestingAll(true);
      let completed = 0;
      let failed = 0;
      let cursor = 0;
      const worker = async () => {
        while (cursor < nodes.length) {
          const node = nodes[cursor];
          cursor += 1;
          try {
            const result = await testDelay(node.tag);
            if (!result.delay) {
              failed += 1;
              continue;
            }
            completed += 1;
            setLocal((previous) => ({
              ...previous,
              config: {
                ...previous.config,
                nodes: previous.config.nodes.map((item) =>
                  item.id === node.id ? { ...item, delay: result.delay } : item,
                ),
              },
            }));
          } catch {
            failed += 1;
          }
        }
      };
      try {
        await Promise.all(
          Array.from({ length: Math.min(6, nodes.length) }, () => worker()),
        );
      } finally {
        setTestingAll(false);
      }
      notify(
        completed
          ? `已完成 ${completed} 个节点测速${failed ? `，${failed} 个失败` : ""}`
          : "测速没有返回结果",
        completed ? "success" : "error",
      );
    },
    [notify],
  );

  const chooseNode = useCallback(
    async (node) => {
      if (!core.running) {
        notify("请先启动本地内核，再切换节点", "info");
        return;
      }
      const previousId = selectedNode?.id || null;
      setSelectedNodeId(node.id);
      try {
        const result = await selectNode(node.tag);
        if (!result.ok) throw new Error(result.error || "内核没有接受节点切换");
        notify(`已切换到 ${node.name}`, "success");
      } catch (error) {
        setSelectedNodeId(previousId);
        notify(`切换节点失败：${error.message}`, "error");
      }
    },
    [core.running, notify, selectedNode?.id],
  );

  const toggleFavorite = useCallback(async (nodeId) => {
    const previous = favorites;
    const next = previous.includes(nodeId)
      ? previous.filter((id) => id !== nodeId)
      : [...previous, nodeId];
    setFavorites(next);
    try {
      await updateSettings({ favorites: next });
    } catch (error) {
      setFavorites(previous);
      notify(`收藏保存失败：${error.message}`, "error");
    }
  }, [favorites, notify]);

  const changeMode = useCallback(
    async (nextMode) => {
      if (!core.running) {
        notify("请先启动本地内核，再切换代理模式", "info");
        return;
      }
      const previous = mode;
      setModeState(nextMode);
      try {
        const result = await setMode(nextMode);
        if (!result.ok) throw new Error(result.error || "内核没有接受模式切换");
        notify(`已切换为${nextMode === "rule" ? "规则" : nextMode === "global" ? "全局" : "直连"}模式`, "success");
      } catch (error) {
        setModeState(previous);
        notify(`切换模式失败：${error.message}`, "error");
      }
    },
    [core.running, mode, notify],
  );

  const changeSystemProxy = useCallback(
    async (enabled) => {
      if (enabled && !core.running) {
        notify("请先启动本地内核，再开启系统代理", "info");
        return false;
      }
      try {
        if (enabled) {
          const latest = normalizeSystemProxy(
            await refreshSystemProxy(config.settings.mixedPort),
          );
          setSystemProxyState(latest);
          if (latest.enabled && latest.managedBy !== "tangline") {
            notify(
              latest.managedBy === "external"
                ? "系统代理正由其他应用管理，Tangline 不会覆盖"
                : "无法确认系统代理来源，已取消修改",
              "info",
            );
            return false;
          }
          if (!latest.available) {
            notify(latest.error || "无法读取 macOS 系统代理状态", "error");
            return false;
          }
        }
        const result = await setSystemProxy(enabled);
        if (!result.ok) {
          notify(result.error || "系统代理修改失败", "error");
          if (result.enabled !== undefined) {
            setSystemProxyState((previous) =>
              normalizeSystemProxy({ ...previous, ...result }),
            );
          }
          return false;
        }
        const nextProxy = normalizeSystemProxy({
          ...systemProxy,
          enabled,
          available: true,
          managedBy: enabled ? "tangline" : null,
          service: result.service || systemProxy.service,
          endpoint: enabled
            ? {
                server: "127.0.0.1",
                port: config.settings.mixedPort,
                types: ["HTTP", "HTTPS", "SOCKS"],
              }
            : null,
          error: null,
        });
        setSystemProxyState(nextProxy);
        setCore((previous) => ({ ...previous, systemProxy: nextProxy }));
        notify(enabled ? "系统代理已启用" : "系统代理已关闭", "success");
        return true;
      } catch (error) {
        notify(`系统代理修改失败：${error.message}`, "error");
        return false;
      }
    },
    [config.settings.mixedPort, core.running, notify, systemProxy],
  );

  const changeLaunchAtLogin = useCallback(
    async (enabled) => {
      try {
        await setLaunchAtLogin(enabled);
        setLaunchAtLoginState(enabled);
        notify(enabled ? "已加入登录项" : "已移除登录项", "success");
      } catch (error) {
        notify(`登录项设置失败：${error.message}`, "error");
      }
    },
    [notify],
  );

  const changeAutoConnect = useCallback(async (enabled) => {
    const previous = autoConnect;
    setAutoConnectState(enabled);
    try {
      await updateSettings({ autoConnect: enabled });
      notify(
        enabled
          ? "下次启动 Tangline 时会自动连接"
          : "下次启动 Tangline 时不会自动连接",
        "success",
      );
      return true;
    } catch (error) {
      setAutoConnectState(previous);
      notify(`自动连接设置保存失败：${error.message}`, "error");
      return false;
    }
  }, [autoConnect, notify]);

  const changeTun = useCallback(
    async (enabled) => {
      if (tunBusy || starting) return false;
      const previous = tunEnabled;
      const wasRunning = core.running;
      setTunEnabledState(enabled);
      setTunBusy(true);
      try {
        await updateSettings({ tunEnabled: enabled });
        if (wasRunning) {
          setStarting(true);
          await stopCore();
          const result = await startCore({
            defaultNode: selectedNode?.tag || null,
          });
          if (!result.ok) throw new Error(result.error || "内核没有接受 TUN 切换");
          setCore(result.status);
          if (result.status?.systemProxy) {
            setSystemProxyState(normalizeSystemProxy(result.status.systemProxy));
          }
        }
        notify(
          wasRunning
            ? enabled
              ? "TUN 模式已启用"
              : "TUN 模式已关闭，恢复普通连接"
            : enabled
              ? "TUN 模式已保存，下次启动连接生效"
              : "TUN 模式已关闭",
          "success",
        );
        return true;
      } catch (error) {
        setTunEnabledState(previous);
        await updateSettings({ tunEnabled: previous }).catch(() => {});
        notify(`切换 TUN 模式失败：${error.message}`, "error");
        if (wasRunning && enabled) {
          try {
            const restored = await startCore({
              defaultNode: selectedNode?.tag || null,
            });
            setCore(restored.status);
          } catch {
            // Stop already reset the UI state; the user can reconnect from Overview.
          }
        }
        return false;
      } finally {
        setStarting(false);
        setTunBusy(false);
      }
    },
    [
      core.running,
      notify,
      selectedNode?.tag,
      starting,
      tunBusy,
      tunEnabled,
    ],
  );

  useEffect(() => {
    if (loading || !settingsReady || !autoConnect) return;
    bootAutoConnect();
  }, [autoConnect, bootAutoConnect, loading, settingsReady]);

  const renderPage = () => {
    if (page === "nodes") {
      return (
        <Nodes
          config={config}
          selectedNode={selectedNode}
          favorites={favorites}
          recent={recent}
          onSelect={chooseNode}
          onFavorite={toggleFavorite}
          onTest={testOne}
          onTestAll={testAll}
          testingId={testingId}
          testingAll={testingAll}
          running={core.running}
        />
      );
    }
    if (page === "subscriptions") {
      return <Subscriptions config={config} onRefresh={refresh} refreshing={refreshing} />;
    }
    if (page === "rules") {
      return <Rules config={config} mode={mode} onMode={changeMode} running={core.running} />;
    }
    if (page === "connections") {
      return (
        <Connections
          connections={connections}
          running={core.running}
          refreshing={connectionsRefreshing}
          onRefresh={async () => {
            if (!core.running) {
              notify("请先启动本地内核，再刷新连接", "info");
              return;
            }
            setConnectionsRefreshing(true);
            try {
              const value = await getConnections();
              setConnections(value?.connections || []);
            } catch (error) {
              notify(`读取连接失败：${error.message}`, "error");
            } finally {
              setConnectionsRefreshing(false);
            }
          }}
        />
      );
    }
    if (page === "logs") {
      return (
        <Logs
          logs={logs}
          running={core.running}
          onClear={async () => {
            try {
              const result = await clearLogs();
              if (!result.ok) throw new Error(result.error || "清空日志失败");
              setLogs([]);
            } catch (error) {
              notify(`清空日志失败：${error.message}`, "error");
            }
          }}
        />
      );
    }
    if (page === "settings") {
      return (
        <Settings
          config={config}
          core={core}
          systemProxy={systemProxy}
          onSystemProxy={changeSystemProxy}
          launchAtLogin={launchAtLogin}
          onLaunchAtLogin={changeLaunchAtLogin}
          autoConnect={autoConnect}
          onAutoConnect={changeAutoConnect}
          tunEnabled={tunEnabled}
          tunBusy={tunBusy}
          onTunEnabled={changeTun}
          onRefresh={refresh}
          refreshing={refreshing}
        />
      );
    }
    return (
      <Overview
        config={config}
        running={core.running}
        starting={starting}
        elapsed={elapsed}
        traffic={traffic}
        trafficHistory={trafficHistory}
        selectedNode={selectedNode}
        systemProxy={systemProxy}
        onToggle={toggleConnection}
        onTest={() => selectedNode && testOne(selectedNode)}
        testingSelected={Boolean(selectedNode && testingId === selectedNode.id)}
        onOpenNodes={() => setPage("nodes")}
        onPage={setPage}
        onRefresh={refresh}
        refreshing={refreshing}
      />
    );
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading__mark"><RefreshCw size={22} className="spin" /></div>
        <strong>正在读取本机配置</strong>
        <span>只读取名称、节点与规则摘要</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        onPage={(next) => {
          setPage(next);
          setSidebarOpen(false);
        }}
        running={core.running}
        profileName={config.profileName || config.subscriptions?.[0]?.name}
        nodeCount={config.stats.nodes}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        triggerRef={menuButtonRef}
      />
      <div className="app-content">
        <div className="mobile-bar">
          <button
            type="button"
            className="icon-button"
            ref={menuButtonRef}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "关闭导航" : "打开导航"}
            aria-controls="primary-navigation"
            aria-expanded={sidebarOpen}
          >
            <Menu size={18} />
          </button>
          <strong>{pageMeta[page]}</strong>
          <span className={core.running ? "mobile-bar__online" : ""}>{core.running ? "在线" : "离线"}</span>
        </div>
        <main className="main-scroll">{renderPage()}</main>
        <div className="app-statusbar">
          <span>{isDesktop ? "本机控制台" : "浏览器预览 · 启动 Electron 后启用真实控制"}</span>
          <span className="app-statusbar__right">
            <span className={`status-dot ${core.running ? "is-online" : ""}`} />
            {core.running ? `mihomo 运行中 · ${config.settings.mixedPort}` : "mihomo 未启动"}
          </span>
        </div>
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
