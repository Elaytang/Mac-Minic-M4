import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  RefreshCw,
  Search,
  Star,
  Zap,
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import NodeRow from "../components/NodeRow.jsx";
import EmptyState from "../components/EmptyState.jsx";

const filters = ["全部", "收藏", "最近", "日本", "香港", "新加坡", "美国", "台湾"];

export default function Nodes({
  config,
  selectedNode,
  favorites,
  recent,
  onSelect,
  onFavorite,
  onTest,
  onTestAll,
  testingId,
  testingAll,
  running,
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("全部");
  const [sort, setSort] = useState("default");
  const [testing, setTesting] = useState(false);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    let items = config.nodes.filter((node) => {
      const matchesQuery =
        !normalized ||
        node.name.toLowerCase().includes(normalized) ||
        node.region.toLowerCase().includes(normalized) ||
        node.protocol.toLowerCase().includes(normalized);
      const matchesFilter =
        filter === "全部" ||
        (filter === "收藏" && favorites.includes(node.id)) ||
        (filter === "最近" && recent.includes(node.tag)) ||
        node.region === filter;
      return matchesQuery && matchesFilter;
    });
    if (sort === "delay") {
      items = [...items].sort((a, b) => (a.delay || 9999) - (b.delay || 9999));
    }
    if (sort === "name") {
      items = [...items].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
    }
    return items;
  }, [config.nodes, favorites, filter, query, recent, sort]);

  async function handleTestAll() {
    setTesting(true);
    try {
      await onTestAll(filtered);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="工作区 / 节点"
        title="节点列表"
        description="搜索、测速和收藏都只作用于当前配置，不会改动订阅内容。"
        actions={
          <button
            type="button"
            className="secondary-button"
            onClick={handleTestAll}
            disabled={!running || testing || testingAll}
            title={running ? "测试当前筛选结果" : "启动连接后可测速"}
          >
            <RefreshCw size={15} className={testing || testingAll ? "spin" : ""} />
            {testing || testingAll ? "正在测速" : "全部测速"}
          </button>
        }
      />

      <section className="toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索节点、地区或协议"
            aria-label="搜索节点"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="清空搜索">
              ×
            </button>
          )}
        </label>
        <div className="toolbar__right">
          <div className="segmented" aria-label="排序">
            <button
              type="button"
              className={sort === "default" ? "is-active" : ""}
              onClick={() => setSort("default")}
            >
              默认
            </button>
            <button
              type="button"
              className={sort === "delay" ? "is-active" : ""}
              onClick={() => setSort("delay")}
            >
              延迟 <ArrowUpDown size={13} />
            </button>
            <button
              type="button"
              className={sort === "name" ? "is-active" : ""}
              onClick={() => setSort("name")}
            >
              名称
            </button>
          </div>
        </div>
      </section>

      <div className="filter-row">
        {filters.map((item) => (
          <button
            type="button"
            key={item}
            className={`filter-chip ${filter === item ? "is-active" : ""}`}
            onClick={() => setFilter(item)}
          >
            {item === "收藏" && <Star size={13} />}
            {item === "最近" && <Zap size={13} />}
            {item}
            {item === "全部" && <span>{config.nodes.length}</span>}
          </button>
        ))}
      </div>

      <section className="node-table">
        <div className="node-table__head">
          <span />
          <span>节点</span>
          <span>协议</span>
          <span>延迟</span>
          <span>当前</span>
          <span />
        </div>
        {filtered.length ? (
          filtered.map((node) => (
            <NodeRow
              key={node.id}
              node={node}
              selected={selectedNode?.id === node.id}
              favorite={favorites.includes(node.id)}
              testing={testingId === node.id}
              running={running}
              onSelect={onSelect}
              onFavorite={onFavorite}
              onTest={onTest}
            />
          ))
        ) : (
          <EmptyState
            title="没有匹配的节点"
            description="换一个关键词或清除地区筛选后再试。"
            action={
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setQuery("");
                  setFilter("全部");
                }}
              >
                清除筛选
              </button>
            }
          />
        )}
      </section>
    </div>
  );
}
