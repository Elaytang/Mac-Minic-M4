import { Download, Pause, Play, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";

export default function Logs({ logs, onClear, running }) {
  const [paused, setPaused] = useState(false);
  const [level, setLevel] = useState("all");
  const [clearing, setClearing] = useState(false);
  const frozenLogs = useRef(logs);
  if (!paused) frozenLogs.current = logs;
  const filtered = useMemo(
    () =>
      frozenLogs.current.filter((log) => {
        if (level === "all") return true;
        return log.line.toLowerCase().includes(level);
      }),
    [level, logs, paused],
  );

  function exportLogs() {
    const text = logs.map((log) => `[${new Date(log.at).toLocaleString()}] ${log.line}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tangline-log.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function clear() {
    if (clearing) return;
    setClearing(true);
    try {
      await onClear();
      frozenLogs.current = [];
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="工作区 / 日志"
        title="日志面板"
        description="日志来自本机进程，不包含订阅地址或节点密钥。"
        actions={
          <div className="button-row">
            <button type="button" className="secondary-button secondary-button--small" onClick={() => setPaused(!paused)}>
              {paused ? <Play size={14} /> : <Pause size={14} />}
              {paused ? "继续" : "暂停"}
            </button>
            <button type="button" className="secondary-button secondary-button--small" onClick={exportLogs}>
              <Download size={14} /> 导出
            </button>
          </div>
        }
      />
      <section className="log-console">
        <div className="log-console__bar">
          <div className="log-console__lights" aria-hidden="true"><span /><span /><span /></div>
          <div className="segmented segmented--logs">
            {["all", "error", "warn", "info"].map((item) => (
              <button type="button" key={item} className={level === item ? "is-active" : ""} onClick={() => setLevel(item)}>
                {item === "all" ? "全部" : item.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={clear}
            title="清空日志"
            aria-label="清空日志"
            disabled={clearing}
          >
            <Trash2 size={15} />
          </button>
        </div>
        <div className="log-console__body" aria-live={paused ? "off" : "polite"}>
          {filtered.length ? (
            filtered.slice(-250).map((log) => (
              <div className="log-line" key={log.id}>
                <span className="log-line__time mono">{new Date(log.at).toLocaleTimeString("zh-CN", { hour12: false })}</span>
                <span className={/error|failed|fatal/i.test(log.line) ? "log-line__error" : /warn/i.test(log.line) ? "log-line__warn" : ""}>
                  {log.line}
                </span>
              </div>
            ))
          ) : (
            <div className="log-console__empty">
              {running ? "暂无日志" : "启动内核后，这里会显示实时输出"}
            </div>
          )}
        </div>
        <div className="log-console__footer">
          <span className={paused ? "" : "is-live"}>{paused ? "已暂停显示" : "实时跟随"}</span>
          <span>{filtered.length} 行</span>
        </div>
      </section>
    </div>
  );
}
