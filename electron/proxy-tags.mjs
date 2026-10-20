export const PLACEHOLDER_PROXY_PATTERN =
  /剩余流量|套餐到期|距离下次|官网|过期|客服|群组/i;

export function isPlaceholderProxyName(name) {
  return PLACEHOLDER_PROXY_PATTERN.test(String(name || ""));
}
