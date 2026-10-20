import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  Power,
  RefreshCw,
  Shield,
  Zap,
} from "lucide-react";
import StatusBadge from "./StatusBadge.jsx";
import { delayTone, formatRate, formatUptime } from "../lib/format.js";

export default function ConnectionHero({
  running,
  starting,
  elapsed,
  traffic,
  selectedNode,
  delay,
  systemProxy,
  onToggle,
  onTest,
  testingSelected = false,
  onOpenNodes,
}) {
  const tone = delayTone(delay);
  const proxyEnabled = Boolean(systemProxy?.enabled);
  const proxyLabel = !systemProxy?.available
    ? "状态未知"
    : proxyEnabled
      ? systemProxy.managedBy === "tangline"
        ? "已启用"
        : systemProxy.managedBy === "external"
          ? "其他应用"
          : "已启用"
      : "未启用";
  return (
    <section className={`connection-hero ${running ? "is-running" : ""}`}>
      <div className="connection-hero__top">
        <div className="connection-hero__identity">
          <StatusBadge tone={running ? "online" : "neutral"} pulse={running}>
            {starting ? "正在连接" : running ? "连接稳定" : "准备连接"}
          </StatusBadge>
          <span className="connection-hero__source">
            <Shield size={13} /> 本机控制
          </span>
        </div>
        <div className="connection-hero__meta">
          <span>{running ? "已运行" : "等待启动"}</span>
          <strong className="mono">{formatUptime(elapsed)}</strong>
        </div>
      </div>

      <div className="connection-hero__main">
        <div className="connection-hero__copy">
          <span className="section-kicker">网络路径</span>
          <h2>{running ? "当前连接正常" : "连接尚未启动"}</h2>
          <p>
            {running
              ? "流量正在按当前节点与规则转发，状态每 2 秒刷新。"
              : "选择节点并启动本地内核，即可检查连接与分流状态。"}
          </p>
          <div className="connection-hero__actions">
            <button
              type="button"
              className={`primary-button ${running ? "primary-button--stop" : ""}`}
              onClick={onToggle}
              disabled={starting}
            >
              {starting ? (
                <RefreshCw size={17} className="spin" />
              ) : (
                <Power size={17} />
              )}
              {starting ? "正在启动" : running ? "断开连接" : "启动连接"}
            </button>
            <button type="button" className="secondary-button" onClick={onOpenNodes}>
              选择节点 <ChevronDown size={15} />
            </button>
          </div>
        </div>

        <div className="route-pulse" aria-label="线路脉冲">
          <div className="route-pulse__labels">
            <span>本机</span>
            <span>{selectedNode?.region || "未选节点"}</span>
            <span>Internet</span>
          </div>
          <div className="route-pulse__track">
            <span className="route-pulse__node route-pulse__node--local" />
            <span className="route-pulse__line" />
            <span className="route-pulse__node route-pulse__node--remote">
              <Zap size={13} fill="currentColor" />
            </span>
            <span className="route-pulse__line route-pulse__line--end" />
            <span className="route-pulse__node route-pulse__node--internet" />
            {running && <span className="route-pulse__packet" />}
          </div>
          <div className="route-pulse__caption">
            <strong>{selectedNode?.name || "尚未选择节点"}</strong>
            <span className={`delay delay--${tone}`}>
              {delay ? `${delay} ms` : "延迟未测"}
            </span>
          </div>
        </div>
      </div>

      <div className="connection-hero__metrics">
        <div className="metric">
          <ArrowDownToLine size={16} />
          <span>下载</span>
          <strong className="mono">{formatRate(traffic.down)}</strong>
        </div>
        <div className="metric">
          <ArrowUpFromLine size={16} />
          <span>上传</span>
          <strong className="mono">{formatRate(traffic.up)}</strong>
        </div>
        <div className="metric">
          <Zap size={16} />
          <span>系统代理</span>
          <strong>{proxyLabel}</strong>
        </div>
        <button type="button" className="metric metric--button" onClick={onTest} disabled={!running}>
          <RefreshCw size={16} className={testingSelected ? "spin" : ""} />
          <span>线路测速</span>
          <strong>
            {testingSelected
              ? "正在测速"
              : running
                ? "重新测试"
                : "启动后可用"}
          </strong>
        </button>
      </div>
    </section>
  );
}
