import { useEffect, useState } from "react";
import {
  Check,
  ExternalLink,
  FolderOpen,
  HardDrive,
  KeyRound,
  MonitorCog,
  Network,
  ShieldCheck,
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Toggle from "../components/Toggle.jsx";
import { openExternal } from "../lib/api.js";

export default function Settings({
  config,
  core,
  systemProxy,
  onSystemProxy,
  launchAtLogin,
  onLaunchAtLogin,
  autoConnect,
  onAutoConnect,
  tunEnabled,
  tunBusy,
  onTunEnabled,
  onRefresh,
  refreshing,
}) {
  const [busy, setBusy] = useState(false);
  const [launchBusy, setLaunchBusy] = useState(false);
  const [savedAutoConnect, setSavedAutoConnect] = useState(autoConnect);
  const [autoConnectBusy, setAutoConnectBusy] = useState(false);
  const [savedTun, setSavedTun] = useState(tunEnabled);
  const settings = config.settings;
  const proxyEnabled = Boolean(systemProxy?.enabled);
  const proxyAvailable = systemProxy?.available !== false;
  const proxyManagedByTangline = systemProxy?.managedBy === "tangline";
  const proxyManagedByExternal = systemProxy?.managedBy === "external";
  const proxyCanToggle =
    proxyAvailable &&
    !proxyManagedByExternal &&
    (core.running || proxyEnabled);

  useEffect(() => setSavedAutoConnect(autoConnect), [autoConnect]);
  useEffect(() => setSavedTun(tunEnabled), [tunEnabled]);

  async function handleSystemProxy(next) {
    setBusy(true);
    try {
      await onSystemProxy(next);
    } finally {
      setBusy(false);
    }
  }

  async function handleAutoConnect(next) {
    const previous = savedAutoConnect;
    setSavedAutoConnect(next);
    setAutoConnectBusy(true);
    try {
      const saved = await onAutoConnect(next);
      if (saved === false) setSavedAutoConnect(previous);
    } catch {
      setSavedAutoConnect(previous);
    } finally {
      setAutoConnectBusy(false);
    }
  }

  async function handleLaunchAtLogin(next) {
    setLaunchBusy(true);
    try {
      await onLaunchAtLogin(next);
    } finally {
      setLaunchBusy(false);
    }
  }

  async function handleTun(next) {
    if (tunBusy) return;
    const previous = savedTun;
    setSavedTun(next);
    const saved = await onTunEnabled(next);
    if (saved === false) setSavedTun(previous);
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="工作区 / 设置"
        title="设置"
        description="只开放有真实实现的能力。需要管理员权限的选项会明确提示。"
        actions={
          <button type="button" className="secondary-button" onClick={onRefresh} disabled={refreshing}>
            <FolderOpen size={15} />
            重新读取配置
          </button>
        }
      />
      <div className="settings-layout">
        <div className="settings-main">
          <section className="settings-section">
            <div className="settings-section__heading">
              <div className="settings-section__icon"><Network size={18} /></div>
              <div>
                <h2>网络与代理</h2>
                <p>控制本机流量如何进入代理。</p>
              </div>
            </div>
            <div className="settings-row">
              <div><strong>系统代理</strong><span>将 macOS 的 HTTP 与 HTTPS 代理指向本机 mixed 端口。</span></div>
              <Toggle
                label="系统代理"
                checked={proxyEnabled}
                onChange={handleSystemProxy}
                disabled={busy || !proxyCanToggle}
              />
              {!proxyAvailable && (
                <p className="settings-row__hint settings-row__hint--danger">
                  {systemProxy?.error || "无法读取 macOS 代理状态。请检查网络服务后重试。"}
                </p>
              )}
              {proxyAvailable && proxyManagedByExternal && (
                <p className="settings-row__hint settings-row__hint--external">
                  系统代理正由其他应用管理。Tangline 不会覆盖或关闭它。
                </p>
              )}
              {proxyAvailable && proxyManagedByTangline && (
                <p className="settings-row__hint settings-row__hint--ok">
                  当前由 Tangline 管理{systemProxy.service ? ` · ${systemProxy.service}` : ""}。
                </p>
              )}
              {proxyAvailable && !proxyEnabled && !core.running && (
                <p className="settings-row__hint">启动连接后可修改系统代理。</p>
              )}
              {proxyAvailable && !core.running && proxyEnabled && !proxyManagedByTangline && !proxyManagedByExternal && (
                <p className="settings-row__hint settings-row__hint--danger">内核已停止，但系统代理仍处于开启状态。请关闭它，或到 macOS 网络设置中检查。</p>
              )}
              {proxyAvailable && !core.running && proxyEnabled && proxyManagedByTangline && (
                <p className="settings-row__hint settings-row__hint--danger">
                  内核已停止，但 Tangline 管理的系统代理仍在开启。请关闭它，或重新启动连接。
                </p>
              )}
            </div>
            <div className="settings-row">
              <div><strong>启动后自动连接</strong><span>打开 Tangline 时尝试启动内核。</span></div>
              <Toggle
                label="启动后自动连接"
                checked={savedAutoConnect}
                onChange={handleAutoConnect}
                disabled={autoConnectBusy}
              />
            </div>
            <div className="settings-row">
              <div><strong>登录时启动</strong><span>把 Tangline 加入 macOS 登录项。</span></div>
              <Toggle
                label="登录时启动"
                checked={launchAtLogin}
                onChange={handleLaunchAtLogin}
                disabled={launchBusy}
              />
            </div>
            <div className="settings-row">
              <div>
                <strong>TUN 模式</strong>
                <span>
                  {core.running
                    ? "切换会短暂断开连接；首次启用会请求管理员授权。"
                    : "保存后下次启动连接生效，首次启用会请求管理员授权。"}
                  {proxyManagedByExternal ? " 当前系统代理仍由其他应用管理，Tangline 不做覆盖。" : ""}
                </span>
              </div>
              <Toggle
                label="TUN 模式"
                checked={savedTun}
                onChange={handleTun}
                disabled={tunBusy || core.starting}
              />
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section__heading">
              <div className="settings-section__icon"><HardDrive size={18} /></div>
              <div>
                <h2>配置文件</h2>
                <p>读取已有客户端配置，不覆盖原始文件。</p>
              </div>
            </div>
            <div className="settings-row">
              <div><strong>数据来源</strong><span>{config.source === "karing" ? "Karing" : config.source === "mihomo-party" ? "Clash Party / mihomo" : "预览数据"}</span></div>
              <span className="tag">{config.source}</span>
            </div>
            <div className="settings-row">
              <div><strong>Mixed 端口</strong><span>HTTP 与 SOCKS 共用入口。</span></div>
              <span className="settings-value mono">{settings.mixedPort}</span>
            </div>
            <div className="settings-row">
              <div><strong>控制端口</strong><span>仅供本机控制台访问。</span></div>
              <span className="settings-value mono">{settings.controlPort}</span>
            </div>
            <div className="settings-row">
              <div><strong>DNS 模式</strong><span>来自现有配置，当前版本不会改写。</span></div>
              <span className="settings-value">{settings.dnsMode}</span>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section__heading">
              <div className="settings-section__icon"><KeyRound size={18} /></div>
              <div>
                <h2>隐私与安全</h2>
                <p>控制台不展示订阅 URL、UUID 或密码。</p>
              </div>
            </div>
            <div className="security-note">
              <ShieldCheck size={18} />
              <div>
                <strong>敏感信息留在本机</strong>
                <p>读取配置时只提取名称、协议、地区、节点数与路由摘要。不会上传到远程服务。</p>
              </div>
            </div>
            <div className="settings-row">
              <div><strong>内核</strong><span>{core.running ? "运行中" : "未运行"}</span></div>
              <span className={`settings-status ${core.running ? "settings-status--ok" : ""}`}>
                {core.running ? "已连接" : "待启动"}
              </span>
            </div>
          </section>
        </div>

        <aside className="settings-aside">
          <section className="panel panel--note">
            <div className="panel__heading">
              <div>
                <span className="section-kicker">版本</span>
                <h3>Tangline {__APP_VERSION__}</h3>
              </div>
              <MonitorCog size={18} />
            </div>
            <p>这是一个独立控制台，不修改 Clash Party 或 mihomo 的原始配置。代理内核使用本机已有的 mihomo。</p>
            <button type="button" className="text-button text-button--small" onClick={() => openExternal("https://github.com/MetaCubeX/mihomo")}>
              mihomo 项目 <ExternalLink size={13} />
            </button>
          </section>
          <section className="panel">
            <div className="panel__heading">
              <div>
                <span className="section-kicker">能力清单</span>
                <h3>当前范围</h3>
              </div>
            </div>
            <ul className="capability-list">
              <li><Check size={14} /> 读取现有配置摘要</li>
              <li><Check size={14} /> 启动与停止内核</li>
              <li><Check size={14} /> 节点选择与测速</li>
              <li><Check size={14} /> 路由规则查看</li>
              <li><Check size={14} /> TUN 模式授权</li>
              <li className="is-muted"><span /> 订阅链接编辑</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
