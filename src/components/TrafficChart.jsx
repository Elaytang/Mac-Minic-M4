import { useId, useMemo } from "react";

export default function TrafficChart({ values = [] }) {
  const gradientId = useId().replace(/:/g, "");
  const points = useMemo(() => {
    const data = values;
    if (!data.length) return "";
    const max = Math.max(...data, 1);
    return data
      .map((value, index) => {
        const x = (index / Math.max(data.length - 1, 1)) * 100;
        const y = 64 - (value / max) * 48;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [values]);

  if (!values.length) {
    return (
      <div className="traffic-chart traffic-chart--empty" aria-label="暂无流量采样">
        <span>暂无采样</span>
      </div>
    );
  }

  return (
    <div className="traffic-chart" aria-label="最近流量趋势">
      <svg viewBox="0 0 100 72" preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e76635" stopOpacity=".22" />
            <stop offset="100%" stopColor="#e76635" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M0,72 L${points} L100,72 Z`} fill={`url(#${gradientId})`} />
        <polyline
          points={points}
          fill="none"
          stroke="#e76635"
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
