export default function Logo({ size = 36, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-label="Tangline"
      role="img"
    >
      <defs>
        <linearGradient id="tangline-surface" x1="12" y1="6" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF7A3D" />
          <stop offset="0.3" stopColor="#F7652E" />
          <stop offset="0.75" stopColor="#E2481A" />
          <stop offset="1" stopColor="#CA3710" />
        </linearGradient>
        <linearGradient id="tangline-rim" x1="32" y1="4" x2="32" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.45" />
          <stop offset="0.4" stopColor="#FFFFFF" stopOpacity="0.15" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.04" />
        </linearGradient>
        <filter id="tangline-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#701C06" floodOpacity="0.32" />
        </filter>
      </defs>

      {/* Squircle 容器 */}
      <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#tangline-surface)" />
      
      {/* 边缘微光描边 */}
      <rect x="4.5" y="4.5" width="55" height="55" rx="13.5" stroke="url(#tangline-rim)" strokeWidth="1" />

      {/* 拓扑主体与浮雕 */}
      <g filter="url(#tangline-shadow)">
        <path
          d="M19 21h26M32 21v24"
          stroke="#FFFFFF"
          strokeWidth="3.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="19" cy="21" r="4.2" fill="#FFFFFF" />
        <circle cx="45" cy="21" r="4.2" fill="#FFFFFF" />
        <circle cx="32" cy="45" r="4.2" fill="#FFFFFF" />

        <circle cx="19" cy="21" r="1.8" fill="#B8300D" />
        <circle cx="45" cy="21" r="1.8" fill="#B8300D" />
        <circle cx="32" cy="45" r="1.8" fill="#B8300D" />

        <circle cx="19" cy="21" r="0.7" fill="#FFA875" />
        <circle cx="45" cy="21" r="0.7" fill="#FFA875" />
        <circle cx="32" cy="45" r="0.7" fill="#FFA875" />
      </g>

      {/* 顶部微高光 */}
      <path d="M18 4.75 Q32 4.5 46 4.75" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="0.75" strokeLinecap="round" />
    </svg>
  );
}
