import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import YAML from "yaml";
import { isPlaceholderProxyName } from "./proxy-tags.mjs";

const HOME = os.homedir();

export const DEFAULT_PATHS = {
  karingDir: path.join(HOME, "Library", "Application Support"),
  karingSettings: path.join(
    HOME,
    "Library",
    "Application Support",
    "karing_setting.json",
  ),
  karingSubscriptions: path.join(
    HOME,
    "Library",
    "Application Support",
    "karing_subscribe.json",
  ),
  karingUse: path.join(
    HOME,
    "Library",
    "Application Support",
    "karing_subscribe_use.json",
  ),
  karingRouting: path.join(
    HOME,
    "Library",
    "Application Support",
    "karing_routing_group.json",
  ),
  partyProfile: path.join(
    HOME,
    "Library",
    "Application Support",
    "mihomo-party",
    "profile.yaml",
  ),
  partyProfilesDir: path.join(
    HOME,
    "Library",
    "Application Support",
    "mihomo-party",
    "profiles",
  ),
  partyWorkDir: path.join(
    HOME,
    "Library",
    "Application Support",
    "mihomo-party",
    "work",
  ),
  partyProvidersDir: path.join(
    HOME,
    "Library",
    "Application Support",
    "mihomo-party",
    "work",
    "providers",
  ),
  partyRulesetDir: path.join(
    HOME,
    "Library",
    "Application Support",
    "mihomo-party",
    "work",
    "ruleset",
  ),
  partyCurrentProfile: path.join(
    HOME,
    "Library",
    "Application Support",
    "mihomo-party",
    "profiles",
    "1a07a5a5665.yaml",
  ),
  core: path.join(HOME, ".cpa-runtime", "mihomo", "mihomo"),
};

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function readYaml(file) {
  try {
    return YAML.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function safeText(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function cleanDisplayName(value) {
  return String(value || "")
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}][\uFE0E\uFE0F]?/gu, "")
    .replace(/[\u200D\uFE0E\uFE0F]/g, "")
    .replace(/^\s*(?:[-—·|]+)\s*|\s*(?:[-—·|]+)\s*$/g, "")
    .trim();
}

function cleanNodeName(tag, index) {
  const name = cleanDisplayName(safeText(tag));
  if (!name) return `节点 ${String(index + 1).padStart(2, "0")}`;
  return name.replace(/\|.*$/, "").trim() || `节点 ${index + 1}`;
}

function regionOf(name) {
  const value = safeText(name);
  if (/香港|HK|Hong/i.test(value)) return "香港";
  if (/日本|JP|Japan/i.test(value)) return "日本";
  if (/新加坡|SG|Singapore/i.test(value)) return "新加坡";
  if (/美国|US|United|洛杉矶|纽约|西雅图|凤凰城/i.test(value)) return "美国";
  if (/台湾|TW|Taiwan/i.test(value)) return "台湾";
  if (/英国|UK|London|伦敦/i.test(value)) return "英国";
  if (/韩国|KR|Korea/i.test(value)) return "韩国";
  if (/德国|DE|Germany/i.test(value)) return "德国";
  if (/法国|FR|France/i.test(value)) return "法国";
  if (/加拿大|CA|Canada/i.test(value)) return "加拿大";
  if (/澳大利亚|AU|Australia/i.test(value)) return "澳大利亚";
  return "其他";
}

function protocolLabel(type) {
  const value = safeText(type).toLowerCase();
  if (value === "hysteria2" || value === "hysteria") return "HY2";
  if (value === "vless") return "VLESS";
  if (value === "vmess") return "VMess";
  if (value === "trojan") return "Trojan";
  if (value === "ss") return "SS";
  if (value === "ssr") return "SSR";
  if (value === "wireguard") return "WG";
  if (value === "tuic") return "TUIC";
  return value ? value.toUpperCase() : "节点";
}

function byteLabel(bytes) {
  const value = safeNumber(bytes);
  if (value <= 0) return "未提供";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  let current = value;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${current.toFixed(index > 2 ? 1 : 0)} ${units[index]}`;
}

function readKaring() {
  const settings = readJson(DEFAULT_PATHS.karingSettings) || {};
  const subscriptionsFile = readJson(DEFAULT_PATHS.karingSubscriptions) || {};
  const use = readJson(DEFAULT_PATHS.karingUse) || {};
  const routing = readJson(DEFAULT_PATHS.karingRouting) || {};
  const subscriptionItems = Array.isArray(subscriptionsFile.items)
    ? subscriptionsFile.items
    : [];

  const subscriptions = subscriptionItems.map((item, index) => {
    const servers = Array.isArray(item?.servers) ? item.servers : [];
    return {
      id: `karing-${index}`,
      name: cleanDisplayName(safeText(item?.remark)) || `订阅 ${index + 1}`,
      type: safeText(item?.type, "订阅"),
      enabled: item?.enable !== false,
      nodes: servers.map((server, serverIndex) => {
        const tag = safeText(server?.tag) || `节点 ${serverIndex + 1}`;
        return {
          id: `karing-${index}-${serverIndex}`,
          name: cleanNodeName(tag, serverIndex),
          tag,
          protocol: protocolLabel(server?.type),
          region: regionOf(tag),
          delay: null,
          source: "karing",
        };
      }),
      updatedAt: safeText(item?.updateTime) || null,
      group: safeText(item?.groupid) || null,
    };
  });

  const validSubscriptions = subscriptions.filter(
    (subscription) => subscription.nodes.length > 0,
  );
  const nodes = validSubscriptions.flatMap((subscription) => subscription.nodes);
  const routingItems = Array.isArray(routing?.items) ? routing.items : [];
  const activeRouting = routingItems.find(
    (item) => Array.isArray(item?.groups) && item.groups.length > 0,
  );
  const rules = (activeRouting?.groups || []).map((group, index) => ({
    id: `rule-${index}`,
    name: safeText(group?.name) || `规则 ${index + 1}`,
    target: safeText(group?.outbound) || "跟随节点选择",
    count: Array.isArray(group?.rules) ? group.rules.length : 0,
    enabled: true,
  }));

  const proxy = settings?.proxy || {};
  const tun = settings?.tun || {};
  const dns = settings?.dns || {};
  return {
    source: "karing",
    available: Boolean(settings?.proxy || subscriptionsFile?.items),
    settings: {
      mixedPort: safeNumber(proxy.mixed_port, 3067),
      directPort: safeNumber(proxy.mixed_direct_port, 13065),
      controlPort: safeNumber(proxy.control_port, 3057),
      systemProxy: Boolean(proxy.auto_set_system_proxy),
      autoConnect: Boolean(settings.auto_connect_after_launch),
      autoConnectAtBoot: Boolean(settings.auto_connect_at_boot),
      tunEnabled: Boolean(tun.enable),
      tunStack: safeText(tun.stack, "gvisor"),
      dnsMode: safeText(dns.proxy_resolve_mode, "fakeip"),
      logLevel: safeText(settings?.dev?.log_level, "error"),
    },
    subscriptions,
    activeSubscriptionId:
      validSubscriptions[0]?.id || subscriptions[0]?.id || null,
    nodes,
    rules,
    favorites: Array.isArray(use?.fav) ? use.fav : [],
    recent: Array.isArray(use?.recent)
      ? use.recent.map((item) => safeText(item?.tag)).filter(Boolean)
      : [],
    stats: {
      subscriptions: validSubscriptions.length,
      nodes: nodes.length,
      rules: rules.length,
      regions: new Set(nodes.map((node) => node.region)).size,
    },
  };
}

function providerFiles(providerName) {
  const safeName = String(providerName || "").replace(/[^\w.-]/g, "_");
  const files = [
    path.join(DEFAULT_PATHS.partyProvidersDir, `${providerName}.yaml`),
    path.join(DEFAULT_PATHS.partyProvidersDir, `${safeName}.yaml`),
  ];
  return [...new Set(files)].find((file) => {
    try {
      return fs.statSync(file).isFile();
    } catch {
      return false;
    }
  });
}

function readPartyProviders(providerNames) {
  const all = [];
  for (const name of providerNames) {
    const file = providerFiles(name);
    if (!file) continue;
    const provider = readYaml(file) || {};
    const proxies = Array.isArray(provider.proxies) ? provider.proxies : [];
    proxies.forEach((proxy, index) => {
      if (!proxy?.name || !proxy?.type) return;
      const displayName = cleanNodeName(proxy.name, index);
      all.push({
        id: `provider-${name}-${index}`,
        name: displayName,
        tag: proxy.name,
        protocol: protocolLabel(proxy.type),
        region: regionOf(proxy.name),
        delay: null,
        source: "mihomo-party",
        provider: name,
        isPlaceholder: isPlaceholderProxyName(proxy.name),
      });
    });
  }
  const seen = new Set();
  return all.filter((node) => {
    const key = `${node.provider}:${node.tag}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readParty() {
  const profile = readYaml(DEFAULT_PATHS.partyProfile);
  const items = Array.isArray(profile?.items) ? profile.items : [];
  const currentId = safeText(profile?.current);
  const current = items.find((item) => item?.id === currentId);
  const profileFile = current?.id
    ? path.join(DEFAULT_PATHS.partyProfilesDir, `${current.id}.yaml`)
    : DEFAULT_PATHS.partyCurrentProfile;
  const config = readYaml(profileFile) || {};
  const providerNames = Object.keys(config?.["proxy-providers"] || {});
  const providerNodes = readPartyProviders(providerNames);
  const proxies = Array.isArray(config?.proxies) ? config.proxies : [];
  const directNodes = proxies.map((proxy, index) => {
    const name = cleanNodeName(proxy?.name, index);
    return {
      id: `party-${index}`,
      name,
      tag: proxy?.name || name,
      protocol: protocolLabel(proxy?.type),
      region: regionOf(proxy?.name || name),
      delay: null,
      source: "mihomo-party",
      provider: null,
      isPlaceholder: isPlaceholderProxyName(proxy?.name),
    };
  });
  const nodes = [...directNodes, ...providerNodes].filter(
    (node) => !node.isPlaceholder,
  );
  const groups = Array.isArray(config?.["proxy-groups"])
    ? config["proxy-groups"]
    : [];
  const rules = Array.isArray(config?.rules) ? config.rules : [];
  const subscriptions = items.map((item, index) => {
    const extra = item?.extra || {};
    return {
      id: safeText(item?.id, `party-${index}`),
      name: safeText(item?.name) || `订阅 ${index + 1}`,
      type: safeText(item?.type, "remote"),
      enabled: true,
      nodeCount:
        item?.id === currentId
          ? nodes.length
          : providerNodes.filter((node) => node.provider === item?.name).length,
      nodes: [],
      updatedAt: Number.isFinite(Number(item?.updated))
        ? new Date(Number(item.updated)).toISOString()
        : null,
      traffic: {
        upload: byteLabel(extra.upload),
        download: byteLabel(extra.download),
        total: byteLabel(extra.total),
      },
    };
  });
  if (!subscriptions.length && providerNames.length) {
    subscriptions.push({
      id: "party-current",
      name: safeText(current?.name) || "当前配置",
      type: "mihomo",
      enabled: true,
      nodeCount: nodes.length,
      nodes: [],
      updatedAt: null,
      traffic: null,
    });
  }
  return {
    source: "mihomo-party",
    available: Boolean(profile?.items || providerNames.length || proxies.length),
    profileId: currentId || null,
    profileName: safeText(current?.name) || "当前 mihomo 配置",
    profilePath: profileFile,
    settings: {
      mixedPort: safeNumber(config?.["mixed-port"], safeNumber(config?.port, 7890)),
      directPort: safeNumber(config?.["socks-port"], 7891),
      controlPort: 9090,
      systemProxy: false,
      autoConnect: false,
      autoConnectAtBoot: false,
      tunEnabled: Boolean(config?.tun?.enable),
      tunStack: safeText(config?.tun?.stack, "mixed"),
      dnsMode: safeText(config?.dns?.["enhanced-mode"], "fake-ip"),
      logLevel: safeText(config?.["log-level"], "info"),
    },
    subscriptions,
    activeSubscriptionId: currentId || subscriptions[0]?.id || null,
    nodes,
    rules: rules.slice(0, 500).map((rule, index) => {
      const [type, payload, target] = String(rule).split(",");
      return {
        id: `party-rule-${index}`,
        name: `${type || "规则"} ${payload || ""}`.trim(),
        target: target || "跟随节点选择",
        count: 1,
        enabled: true,
      };
    }),
    groups: groups.map((group) => ({
      name: safeText(group?.name),
      type: safeText(group?.type),
      proxies: Array.isArray(group?.proxies) ? group.proxies : [],
      use: Array.isArray(group?.use) ? group.use : [],
    })),
    favorites: [],
    recent: [],
    stats: {
      subscriptions: subscriptions.length,
      nodes: nodes.length,
      rules: rules.length,
      regions: new Set(nodes.map((node) => node.region)).size,
    },
  };
}

function publicConfig(config) {
  if (!config) return null;
  return {
    source: config.source,
    available: config.available,
    profileId: config.profileId || null,
    profileName: config.profileName || null,
    profilePath: config.profilePath || null,
    settings: config.settings,
    subscriptions: config.subscriptions.map((subscription) => ({
      id: subscription.id,
      name: subscription.name,
      type: subscription.type,
      enabled: subscription.enabled,
      nodeCount: subscription.nodeCount ?? subscription.nodes?.length ?? 0,
      updatedAt: subscription.updatedAt,
      traffic: subscription.traffic || null,
    })),
    activeSubscriptionId: config.activeSubscriptionId,
    nodes: config.nodes,
    rules: config.rules,
    groups: config.groups || [],
    favorites: config.favorites,
    recent: config.recent,
    stats: config.stats,
  };
}

export function readLocalConfig(paths = DEFAULT_PATHS) {
  const karing = readKaring(paths);
  const party = readParty(paths);
  const preferred =
    party.nodes.length > 0
      ? party
      : karing.nodes.length > 0
        ? karing
        : party.available
          ? party
          : karing;
  return {
    config: publicConfig(preferred),
    candidates: [party, karing]
      .filter((item) => item.available)
      .map((item) => ({
        source: item.source,
        profileName: item.profileName || null,
        nodeCount: item.nodes.length,
        subscriptionCount: item.subscriptions.length,
      })),
    paths: {
      karing: DEFAULT_PATHS.karingSettings,
      party: DEFAULT_PATHS.partyProfile,
      core: DEFAULT_PATHS.core,
    },
  };
}

export function findWorkingProfile() {
  const party = readParty();
  return party.available ? party : null;
}

export function safePublicConfig(config) {
  return publicConfig(config);
}
