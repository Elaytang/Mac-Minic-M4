import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock3,
  Layers3,
  RefreshCw,
  Server,
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import { formatTime } from "../lib/format.js";

export default function Subscriptions({ config, onRefresh, refreshing }) {
  return (
    <div className="page">
      <PageHeader
        eyebrow="工作区 / 订阅"
        title="订阅管理"
        description="这里只展示订阅名称、节点数量与最近更新时间；订阅地址和密钥不会进入界面。"
        actions={
          <button type="button" className="secondary-button" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? "spin" : ""} />
            {refreshing ? "正在读取" : "刷新订阅"}
          </button>
        }
      />

      <div className="subscription-list">
        {config.subscriptions.map((subscription) => (
          <article
            className={`subscription-card ${subscription.id === config.activeSubscriptionId ? "is-active" : ""}`}
            key={subscription.id}
          >
            <div className="subscription-card__icon">
              <Layers3 size={18} />
            </div>
            <div className="subscription-card__main">
              <div className="subscription-card__title">
                <h2>{subscription.name}</h2>
                {subscription.id === config.activeSubscriptionId && (
                  <span className="tag tag--accent">当前配置</span>
                )}
                <span className="tag">{subscription.type}</span>
              </div>
              <div className="subscription-card__facts">
                <span><Server size={14} /> {subscription.nodeCount} 个节点</span>
                <span><Clock3 size={14} /> {formatTime(subscription.updatedAt)}</span>
                {subscription.traffic && (
                  <>
                    <span><ArrowDownToLine size={14} /> {subscription.traffic.download}</span>
                    <span><ArrowUpFromLine size={14} /> {subscription.traffic.upload}</span>
                    <span className="mono">总量 {subscription.traffic.total}</span>
                  </>
                )}
              </div>
            </div>
            <div className="subscription-card__actions">
              <button type="button" className="secondary-button secondary-button--small" onClick={onRefresh}>
                重新读取
              </button>
            </div>
          </article>
        ))}
      </div>

      <section className="panel panel--info">
        <div>
          <span className="section-kicker">导入方式</span>
          <h3>新增订阅</h3>
          <p>当前版本先读取现有客户端配置。订阅导入会在独立设置页完成，并保留原配置文件快照。</p>
        </div>
        <button type="button" className="secondary-button" disabled title="将在下一版本提供">
          导入订阅
        </button>
      </section>
    </div>
  );
}
