import { Circle } from "lucide-react";

export default function StatusBadge({ tone = "neutral", children, pulse = false }) {
  return (
    <span className={`status-badge status-badge--${tone}`}>
      <Circle size={7} fill="currentColor" strokeWidth={0} className={pulse ? "pulse-dot" : ""} />
      {children}
    </span>
  );
}
