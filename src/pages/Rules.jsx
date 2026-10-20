import { useMemo, useState } from "react";
import { ArrowRight, Check, Search, ShieldCheck } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function Rules({ config, mode, onMode, running }) {
  const [query, setQuery] = useState("");
  const rules = useMemo(
    () =>
      config.rules.filter(
        (rule) =>
          !query.trim() ||
          rule.name.toLowerCase().includes(query.trim().toLowerCase()) ||
          rule.target.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [config.rules, query],
  );

  return (
    <div className="page">
      <PageHeader
        eyebrow="工作区 / 路由规则"
        title="路由规则"
        description="规则按顺序匹配，命中后交给对应出口。这里展示当前配置的只读摘要。"
      />

      <div className="mode-strip">
        <div>
          <span className="section-kicker">代理模式</span>
          <strong>
            {running
              ? "规则模式会按域名与地址自动分流"
              : "启动连接后可切换代理模式"}
          </strong>
        </div>
        <div className="segmented segmented--mode" aria-disabled={!running}>
          {[
            ["rule", "规则"],
            ["global", "全局"],
            ["direct", "直连"],
          ].map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={mode === id ? "is-active" : ""}
              onClick={() => onMode(id)}
              disabled={!running}
            >
              {mode === id && <Check size={13} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="rules-layout">
        <div className="panel rules-panel">
          <div className="panel__heading panel__heading--stack">
            <div>
              <span className="section-kicker">规则列表</span>
              <h3>{config.stats.rules} 条规则组</h3>
            </div>
            <label className="search-field search-field--small">
              <Search size={15} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="筛选规则"
                aria-label="筛选规则"
              />
            </label>
          </div>
          <div className="rule-list">
            {rules.length ? (
              rules.map((rule, index) => (
                <div className="rule-row" key={rule.id}>
                  <span className="rule-row__index mono">{String(index + 1).padStart(2, "0")}</span>
                  <div className="rule-row__name">
                    <strong>{rule.name}</strong>
                    <small>{rule.count ? `${rule.count} 条匹配项` : "配置摘要"}</small>
                  </div>
                  <ArrowRight size={14} />
                  <span className={`rule-target ${rule.target === "REJECT" ? "is-reject" : ""}`}>
                    {rule.target}
                  </span>
                </div>
              ))
            ) : (
              <EmptyState title="没有匹配的规则" description="换一个关键词再试。" />
            )}
          </div>
        </div>
        <aside className="rules-side">
          <section className="panel">
            <div className="panel__heading">
              <div>
                <span className="section-kicker">分流概览</span>
                <h3>规则去向</h3>
              </div>
              <ShieldCheck size={18} />
            </div>
            <div className="rule-summary">
              <div><span>代理</span><strong>{config.rules.filter((rule) => rule.target !== "DIRECT" && rule.target !== "REJECT").length}</strong></div>
              <div><span>直连</span><strong>{config.rules.filter((rule) => rule.target === "DIRECT").length}</strong></div>
              <div><span>拦截</span><strong>{config.rules.filter((rule) => rule.target === "REJECT").length}</strong></div>
            </div>
          </section>
          <section className="panel panel--note">
            <div className="panel__heading">
              <div>
                <span className="section-kicker">编辑规则</span>
                <h3>当前只读</h3>
              </div>
            </div>
            <p>规则来自现有配置，当前版本不会直接改写文件。需要编辑时，先在设置页创建快照。</p>
          </section>
        </aside>
      </section>
    </div>
  );
}
