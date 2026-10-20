import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export default function Toast({ toast, onClose }) {
  if (!toast) return null;
  const Icon = icons[toast.tone] || Info;
  return (
    <div
      className={`toast toast--${toast.tone || "info"}`}
      role={toast.tone === "error" ? "alert" : "status"}
    >
      <Icon size={17} />
      <span>{toast.message}</span>
      <button type="button" onClick={onClose} aria-label="关闭提示">
        <X size={15} />
      </button>
    </div>
  );
}
