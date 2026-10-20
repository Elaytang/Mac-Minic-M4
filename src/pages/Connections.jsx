import { Activity, Globe2, Search, ShieldCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { formatBytes, formatTime } from "../lib/format.js";

export default function Connections({ connections, running, onRefresh, refreshing }) {
  const [query, setQuery] = useState("");
  const total = Array.isArray(connections) ? connections.length : 0;
  const items = useMemo(() => {
    const list = Array.isArray(connections) ? connections : [];
    return list.filter((item) => {
      if (!query.trim()) return true;
      return `${item.host || ""} ${item.destinationIP || ""} ${item.rule || ""} ${item.chains?.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase());
    });
  }, [connections, query]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="工作区 / 连接"
        title="连接面板"
        description="显示内核返回的活动连接。敏感地址只在本机渲染，不写入日志。"
        actions={
          <button
            type="button"
            className="secondary-button"
            onClick={onRefresh}
            disabled={!running || refreshing}
            title={running ? "刷新活动连接" : "启动连接后可刷新"}
          >
            <Activity size={15} className={refreshing ? "spin" : ""} />
            刷新
          </button>
        }
      />
      <div className="connection-summary">
        <div><Activity size={18} /><span>活动连接</span><strong>{total}</strong></div>
        <div><ShieldCheck size={18} /><span>控制状态</span><strong>{running ? "已连接" : "未启动"}</strong></div>
        <div><Globe2 size={18} /><span>数据来源</span><strong>本机内核</strong></div>
      </div>
      <section className="panel connection-panel">
        <div className="panel__heading panel__heading--stack">
          <div>
            <span className="section-kicker">实时列表</span>
            <h3>活动请求</h3>
          </div>
          <div className="connection-panel__tools">
            <span className="connection-panel__count">
              {query.trim() ? `${items.length} / ${total}` : total} 条
            </span>
            <label className="search-field search-field--small">
              <Search size={15} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索域名、规则或链路"
                aria-label="搜索连接"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="清空连接搜索">
                  <X size={14} />
                </button>
              )}
            </label>
          </div>
        </div>
        {items.length ? (
          <div className="connection-table">
            <div className="connection-table__head">
              <span>目标</span><span>规则</span><span>链路</span><span>上传</span><span>下载</span><span>时间</span>
            </div>
            {items.slice(0, 100).map((item) => (
              <div className="connection-row" key={item.id}>
                <span className="connection-row__host">{item.host || item.destinationIP || "未知目标"}</span>
                <span>{item.rule || "未命中"}</span>
                <span>{Array.isArray(item.chains) && item.chains.length ? item.chains.join(" → ") : "直连"}</span>
                <span className="mono">{formatBytes(item.upload)}</span>
                <span className="mono">{formatBytes(item.download)}</span>
                <span className="mono">{formatTime(item.start)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title={
              !running
                ? "内核还没有启动"
                : query.trim()
                  ? "没有匹配的连接"
                  : "暂时没有活动连接"
            }
            description={
              !running
                ? "启动连接后可以查看实时请求。"
                : query.trim()
                  ? `没有目标、规则或链路包含“${query.trim()}”。`
                  : "新的请求会出现在这里。"
            }
            action={
              running && query.trim() ? (
                <button type="button" className="text-button" onClick={() => setQuery("")}>
                  清除搜索
                </button>
              ) : null
            }
          />
        )}
      </section>
    </div>
  );
}
