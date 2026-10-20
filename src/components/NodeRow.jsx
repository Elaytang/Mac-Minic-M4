import { Star, Zap } from "lucide-react";
import { delayTone } from "../lib/format.js";

export default function NodeRow({
  node,
  selected,
  favorite,
  testing,
  onSelect,
  onFavorite,
  onTest,
  running = false,
}) {
  const tone = delayTone(node.delay);
  return (
    <div className={`node-row ${selected ? "is-selected" : ""}`}>
      <button
        type="button"
        className={`star-button ${favorite ? "is-favorite" : ""}`}
        onClick={() => onFavorite(node.id)}
        aria-label={favorite ? `取消收藏 ${node.name}` : `收藏 ${node.name}`}
        title={favorite ? "取消收藏" : "收藏"}
      >
        <Star size={15} fill={favorite ? "currentColor" : "none"} />
      </button>
      <button type="button" className="node-row__main" onClick={() => onSelect(node)}>
        <span className={`region-mark region-mark--${node.region}`}>
          {node.region.slice(0, 1)}
        </span>
        <span className="node-row__name">
          <strong>{node.name}</strong>
          <small>
            {node.protocol} · {node.region}
          </small>
        </span>
        <span className={`protocol protocol--${node.protocol.toLowerCase()}`}>
          {node.protocol}
        </span>
        <span className={`delay delay--${tone}`}>
          {testing ? (
            <Zap size={13} className="spin" />
          ) : node.delay ? (
            `${node.delay} ms`
          ) : (
            "未测速"
          )}
        </span>
        <span className={`node-row__check ${selected ? "is-visible" : ""}`}>
          <span />
        </span>
      </button>
      <button
        type="button"
        className="node-row__test"
        onClick={() => onTest(node)}
        aria-label={`测试 ${node.name} 延迟`}
        title={running ? "测试延迟" : "启动连接后可测速"}
        disabled={!running}
      >
        <Zap size={14} />
      </button>
    </div>
  );
}
