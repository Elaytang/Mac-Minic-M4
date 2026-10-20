import {
  Activity,
  Cable,
  FileText,
  Gauge,
  Layers3,
  RadioTower,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import Logo from "./Logo.jsx";
import StatusBadge from "./StatusBadge.jsx";

const items = [
  { id: "overview", label: "总览", icon: Gauge },
  { id: "nodes", label: "节点", icon: RadioTower },
  { id: "subscriptions", label: "订阅", icon: Layers3 },
  { id: "rules", label: "路由规则", icon: Cable },
  { id: "connections", label: "连接", icon: Activity },
  { id: "logs", label: "日志", icon: FileText },
];

export default function Sidebar({
  page,
  onPage,
  running,
  profileName,
  nodeCount,
  open,
  onClose,
  triggerRef,
}) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeButtonRef.current?.focus();
    return () => {
      triggerRef.current?.focus();
    };
  }, [open, triggerRef]);

  return (
    <>
      <button
        type="button"
        className={`sidebar-scrim ${open ? "is-open" : ""}`}
        onClick={onClose}
        aria-label="关闭导航"
        tabIndex={-1}
      />
      <aside
        id="primary-navigation"
        className={`sidebar ${open ? "is-open" : ""}`}
        aria-label="主导航"
      >
        <div className="sidebar__drag" />
        <button
          type="button"
          className="sidebar__close"
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="关闭导航"
          aria-controls="primary-navigation"
          aria-expanded={open}
        >
          <X size={17} />
        </button>
        <div className="brand">
          <Logo size={36} />
          <div className="brand__text">
            <strong>Tangline</strong>
            <span>MACOS NETWORK CONSOLE</span>
          </div>
        </div>

        <div className="sidebar__profile">
          <span className="sidebar__eyebrow">当前配置</span>
          <strong>{profileName || "本地配置"}</strong>
          <StatusBadge tone={running ? "online" : "neutral"} pulse={running}>
            {running ? "运行中" : "未连接"}
          </StatusBadge>
        </div>

        <nav className="nav" aria-label="工作区">
          <span className="nav__label">工作区</span>
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`nav__item ${page === id ? "is-active" : ""}`}
              title={label}
              aria-label={label}
              onClick={() => onPage(id)}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {id === "nodes" && <small>{nodeCount}</small>}
            </button>
          ))}
        </nav>

        <div className="sidebar__bottom">
          <button
            type="button"
            className={`nav__item ${page === "settings" ? "is-active" : ""}`}
            title="设置"
            aria-label="设置"
            onClick={() => onPage("settings")}
          >
            <Settings size={17} strokeWidth={1.8} />
            <span>设置</span>
          </button>
          <div className="sidebar__privacy">
            <ShieldCheck size={15} />
            <span>配置只在本机读取</span>
          </div>
        </div>
      </aside>
    </>
  );
}
