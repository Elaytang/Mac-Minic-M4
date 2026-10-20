import {
  Activity,
  ArrowRight,
  CircleDot,
  Globe2,
  Layers3,
  RadioTower,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import ConnectionHero from "../components/ConnectionHero.jsx";
import PageHeader from "../components/PageHeader.jsx";
import SummaryCard from "../components/SummaryCard.jsx";
import TrafficChart from "../components/TrafficChart.jsx";
import { delayTone, formatRate } from "../lib/format.js";

export default function Overview({
  config,
  running,
  starting,
  elapsed,
  traffic,
  trafficHistory,
  selectedNode,
  systemProxy,
  onToggle,
  onTest,
  testingSelected,
  onOpenNodes,
  onPage,
  onRefresh,
  refreshing,
}) {
  const topNodes = [...config.nodes]
    .filter((node) => node.delay)
    .sort((a, b) => a.delay - b.delay)
    .slice(0, 4);
  const proxyDetail = !systemProxy?.available
    ? systemProxy?.error || "无法读取状态"
    : systemProxy?.managedBy === "external"
      ? "由其他应用管理"
      : systemProxy?.managedBy === "tangline"
        ? `本机 ${config.settings.mixedPort}`
        : systemProxy?.enabled
          ? "已启用"
          : "未启用";
  return (
    <div className="page">
      <PageHeader
        eyebrow="工作区 / 总览"
        title="连接概览"
        description="检查当前线路、系统代理与流量状态。所有配置只在本机读取。"
        actions={
          <button type="button" className="secondary-button" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? "spin" : ""} />
            {refreshing ? "正在读取" : "刷新配置"}
          </button>
        }
      />

      <ConnectionHero
        running={running}
        starting={starting}
        elapsed={elapsed}
        traffic={traffic}
        selectedNode={selectedNode}
        delay={selectedNode?.delay}
        systemProxy={systemProxy}
        onToggle={onToggle}
        onTest={onTest}
        testingSelected={testingSelected}
        onOpenNodes={onOpenNodes}
      />

      <div className="summary-grid">
        <SummaryCard
          icon={RadioTower}
          label="可用节点"
          value={config.stats.nodes}
          detail={`${config.stats.regions} 个地区`}
        />
        <SummaryCard
          icon={Layers3}
          label="订阅"
          value={config.stats.subscriptions}
          detail="有效配置"
        />
        <SummaryCard
          icon={ShieldCheck}
          label="路由规则"
          value={config.stats.rules}
          detail="已读取"
        />
        <SummaryCard
          icon={Globe2}
          label="当前线路"
          value={selectedNode?.region || "未选择"}
          detail={`${selectedNode?.protocol || "等待节点"} · 代理：${proxyDetail}`}
          tone={running ? "accent" : "default"}
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel panel--traffic">
          <div className="panel__heading">
            <div>
              <span className="section-kicker">实时流量</span>
              <h3>过去一分钟</h3>
            </div>
            <div className="traffic-legend">
              <span><i className="legend-dot legend-dot--down" />下载 {formatRate(traffic.down)}</span>
              <span><i className="legend-dot legend-dot--up" />上传 {formatRate(traffic.up)}</span>
            </div>
          </div>
          <TrafficChart values={trafficHistory} />
          <div className="traffic-footer">
            <span>速率采样每 2 秒</span>
            <span className="mono">{running ? "LIVE" : "PAUSED"}</span>
          </div>
        </section>

        <section className="panel panel--quick">
          <div className="panel__heading">
            <div>
              <span className="section-kicker">快捷入口</span>
              <h3>继续处理</h3>
            </div>
          </div>
          <button type="button" className="quick-row" onClick={onOpenNodes}>
            <div className="quick-row__icon"><RadioTower size={17} /></div>
            <div>
              <strong>切换节点</strong>
              <span>{config.nodes.length} 个节点可选</span>
            </div>
            <ArrowRight size={16} />
          </button>
          <button type="button" className="quick-row" onClick={() => onPage("rules")}>
            <div className="quick-row__icon"><ShieldCheck size={17} /></div>
            <div>
              <strong>检查路由</strong>
              <span>{config.stats.rules} 条规则正在使用</span>
            </div>
            <ArrowRight size={16} />
          </button>
          <button type="button" className="quick-row" onClick={() => onPage("connections")}>
            <div className="quick-row__icon"><Activity size={17} /></div>
            <div>
              <strong>实时连接</strong>
              <span>查看当前活动请求</span>
            </div>
            <ArrowRight size={16} />
          </button>
        </section>

        <section className="panel panel--nodes">
          <div className="panel__heading">
            <div>
              <span className="section-kicker">低延迟线路</span>
              <h3>测速结果</h3>
            </div>
            <button type="button" className="text-button text-button--small" onClick={onOpenNodes}>
              查看全部 <ArrowRight size={14} />
            </button>
          </div>
          {topNodes.length ? (
            <div className="overview-nodes">
              {topNodes.map((node, index) => (
                <div className="overview-node" key={node.id}>
                  <span className="overview-node__rank mono">0{index + 1}</span>
                  <span className={`region-mark region-mark--${node.region}`}>
                    {node.region.slice(0, 1)}
                  </span>
                  <div>
                    <strong>{node.name}</strong>
                    <small>{node.protocol} · {node.region}</small>
                  </div>
                  <span className={`delay delay--${delayTone(node.delay)}`}>{node.delay} ms</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="inline-empty">
              <CircleDot size={17} />
              <span>还没有测速结果。连接后可测试当前线路。</span>
            </div>
          )}
        </section>

        <section className="panel panel--note">
          <div className="panel__heading">
            <div>
              <span className="section-kicker">运行说明</span>
              <h3>能力边界</h3>
            </div>
          </div>
          <p>
            当前版本使用本机 <code>mihomo</code> 管理代理与系统代理。TUN 需要额外授权，未授权时会明确显示为不可用。
          </p>
          <button type="button" className="text-button text-button--small" onClick={() => onPage("settings")}>
            查看设置 <ArrowRight size={14} />
          </button>
        </section>
      </div>
    </div>
  );
}
