export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let current = value;
  let index = -1;
  do {
    current /= 1024;
    index += 1;
  } while (current >= 1024 && index < units.length - 1);
  return `${current.toFixed(current >= 100 ? 0 : current >= 10 ? 1 : 2)} ${units[index]}`;
}

export function formatRate(bytesPerSecond) {
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatTime(timestamp) {
  if (!timestamp) return "未知";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatUptime(ms) {
  if (!ms) return "00:00";
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function delayTone(delay) {
  if (!delay) return "unknown";
  if (delay < 80) return "fast";
  if (delay < 180) return "medium";
  return "slow";
}
