import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import YAML from "yaml";
import { DEFAULT_PATHS } from "./config-reader.mjs";
import { isPlaceholderProxyName } from "./proxy-tags.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const RUNTIME_ROOT = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Tangline",
);
const CORE_WORK_DIR = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "mihomo-party",
  "work",
);

function exists(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(options.timeout || 2500),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const error = new Error(
      body?.message || body?.error || `HTTP ${response.status}`,
    );
    error.status = response.status;
    throw error;
  }
  return body;
}

function readYaml(file) {
  try {
    return YAML.parse(fs.readFileSync(file, "utf8")) || {};
  } catch {
    return {};
  }
}

function setTopLevelYamlValue(source, key, value) {
  const line = `${key}: ${value}`;
  const pattern = new RegExp(
    `^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:.*$`,
    "m",
  );
  if (pattern.test(source)) return source.replace(pattern, line);
  return `${line}\n${source}`;
}

function removeStaleRuntimeFiles(runtimeDir) {
  try {
    fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
    for (const name of ["runtime.yaml", "runtime.log"]) {
      const file = path.join(runtimeDir, name);
      try {
        fs.rmSync(file, { force: true });
      } catch {
        // The old process may still be releasing the runtime file.
      }
    }
  } catch (error) {
    throw new Error(`无法创建运行目录：${error.message}`);
  }
}

export function applyTunOptions(config, { mixedPort } = {}) {
  const next = { ...config };
  next.tun = {
    ...(next.tun || {}),
    enable: true,
    stack: next.tun?.stack || "gvisor",
    "dns-hijack": next.tun?.["dns-hijack"] || ["any:53"],
    "auto-route": true,
    "auto-detect-interface": true,
    "strict-route": false,
    mtu: next.tun?.mtu || 1500,
  };
  next.dns = {
    ...(next.dns || {}),
    enable: true,
    listen: next.dns?.listen || "127.0.0.1:1053",
    "enhanced-mode": next.dns?.["enhanced-mode"] || "fake-ip",
    "fake-ip-range": next.dns?.["fake-ip-range"] || "198.18.0.1/16",
  };
  if (Number.isInteger(Number(mixedPort))) {
    next["mixed-port"] = Number(mixedPort);
  }
  return next;
}

function isPidRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "EPERM") return true;
    return false;
  }
}

function normalizeProxyMap(raw) {
  const entries = Object.entries(raw?.proxies || {}).map(([name, value]) => ({
    name,
    type: String(value?.type || "").toLowerCase(),
    now: value?.now || null,
    all: Array.isArray(value?.all) ? value.all : [],
    history: Array.isArray(value?.history) ? value.history : [],
    udp: Boolean(value?.udp),
  }));
  const byName = new Map(entries.map((item) => [item.name, item]));
  return { entries, byName };
}

function parseNetworkProxy(output) {
  const fields = {};
  for (const line of String(output || "").split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key) fields[key] = value;
  }
  const enabledValue = String(fields.enabled || "").toLowerCase();
  const port = Number(fields.port);
  return {
    enabled: enabledValue === "yes" || enabledValue === "1",
    server: fields.server || "",
    port: Number.isInteger(port) && port > 0 ? port : null,
  };
}

function isLoopbackHost(host) {
  return /^(127\.0\.0\.1|localhost|::1)$/i.test(String(host || ""));
}

export function classifySystemProxy({
  service,
  web,
  secureWeb,
  socks,
  expectedPort,
  ownership,
}) {
  const entries = [
    ["HTTP", web],
    ["HTTPS", secureWeb],
    ["SOCKS", socks],
  ];
  const active = entries
    .filter(([, proxy]) => proxy?.enabled)
    .map(([type, proxy]) => ({ type, ...proxy }));
  if (!active.length) {
    return {
      enabled: false,
      available: true,
      service: service || null,
      managedBy: null,
      endpoint: null,
      proxies: Object.fromEntries(entries.map(([type, proxy]) => [type, proxy])),
    };
  }

  const primary = active.find(
    (proxy) => isLoopbackHost(proxy.server) && proxy.port === Number(expectedPort),
  );
  const owned =
    ownership?.enabled === true &&
    ownership?.service === service &&
    isLoopbackHost(ownership?.server) &&
    Number(ownership?.port) === Number(primary?.port || ownership?.port) &&
    Boolean(primary);
  return {
    enabled: true,
    available: true,
    service: service || null,
    managedBy: owned ? "tangline" : "external",
    endpoint: primary
      ? {
          server: primary.server,
          port: primary.port,
          types: active.map((proxy) => proxy.type),
        }
      : {
          server: active[0].server,
          port: active[0].port,
          types: active.map((proxy) => proxy.type),
        },
    proxies: Object.fromEntries(entries.map(([type, proxy]) => [type, proxy])),
  };
}

export function proxyOwnershipFromStatus(status) {
  if (
    !status?.enabled ||
    status.managedBy !== "tangline" ||
    typeof status.service !== "string" ||
    !status.service ||
    !isLoopbackHost(status.endpoint?.server)
  ) {
    return null;
  }
  const port = Number(status.endpoint?.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return {
    enabled: true,
    service: status.service,
    server: "127.0.0.1",
    port,
  };
}

export function isSelectableProxy(item) {
  return item?.type === "select" || item?.type === "selector";
}

export function chooseDirectGroup(proxyMap, nodeName) {
  const { entries, byName } = proxyMap;
  const isSelectable = isSelectableProxy;
  const direct = proxyMap.entries.filter(
    (item) => isSelectable(item) && item.all.includes(nodeName),
  );
  if (!direct.length) return null;

  const referenced = new Set(
    entries.flatMap((item) =>
      item.all.filter((name) => isSelectable(byName.get(name) || {})),
    ),
  );
  const roots = direct.filter((item) => referenced.has(item.name));
  const candidates = roots.length ? roots : direct;
  const priority = ["GLOBAL", "节点选择", "Proxy", "代理"];
  return (
    priority
      .map((name) => candidates.find((item) => item.name === name))
      .find(Boolean) ||
    candidates.find((item) => item.name.includes("代理")) ||
    candidates[0]
  );
}

export class CoreManager {
  constructor({ onEvent } = {}) {
    this.onEvent = onEvent || (() => {});
    this.process = null;
    this.profilePath = null;
    this.controller = null;
    this.secret = "";
    this.logs = [];
    this.lastTraffic = null;
    this.lastError = null;
    this.startedAt = null;
    this.mixedPort = null;
    this.runtimeProfile = null;
    this.trafficSample = null;
    this.proxyMap = null;
    this.expectedExit = false;
    this.stopRequested = false;
    this.starting = false;
    this.mode = "rule";
    this.privilegedPid = null;
    this.privilegedMonitor = null;
    this.privilegedLogOffset = 0;
    this.tun = { enabled: false, error: null };
    this.systemProxy = {
      enabled: false,
      available: true,
      service: null,
      managedBy: null,
      endpoint: null,
      error: null,
    };
  }

  get status() {
    return {
      running: this.isRunning(),
      pid: this.process?.pid || this.privilegedPid || null,
      tun: { ...this.tun },
      controller: this.controller,
      profilePath: this.profilePath,
      runtimeProfile: this.runtimeProfile,
      mixedPort: this.mixedPort,
      startedAt: this.startedAt,
      mode: this.mode,
      systemProxy: { ...this.systemProxy },
      error: this.lastError,
      starting: this.starting,
    };
  }

  isRunning() {
    if (this.process && this.process.exitCode === null) return true;
    return isPidRunning(this.privilegedPid);
  }

  startPrivilegedMonitor(logFile) {
    this.clearPrivilegedMonitor();
    const interval = setInterval(() => {
      const pid = this.privilegedPid;
      if (!isPidRunning(pid)) {
        this.clearPrivilegedMonitor();
        this.privilegedPid = null;
        this.startedAt = null;
        this.starting = false;
        if (!this.stopRequested) {
          this.lastError = "TUN 内核意外退出";
          this.pushLog(this.lastError);
        }
        this.emit("core-stopped", {
          code: null,
          signal: null,
          expected: this.stopRequested,
          stopRequested: this.stopRequested,
          error: this.lastError,
          systemProxy: { ...this.systemProxy },
        });
        this.stopRequested = false;
        return;
      }
      this.consumePrivilegedLog(logFile);
    }, 700);
    interval.unref?.();
    this.privilegedMonitor = interval;
  }

  consumePrivilegedLog(logFile) {
    try {
      const stat = fs.statSync(logFile);
      if (stat.size < this.privilegedLogOffset) this.privilegedLogOffset = 0;
      if (stat.size === this.privilegedLogOffset) return;
      const length = stat.size - this.privilegedLogOffset;
      const buffer = Buffer.alloc(length);
      const handle = fs.openSync(logFile, "r");
      try {
        fs.readSync(handle, buffer, 0, length, this.privilegedLogOffset);
      } finally {
        fs.closeSync(handle);
      }
      this.privilegedLogOffset = stat.size;
      String(buffer)
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => this.pushLog(line));
    } catch {
      // The log can briefly disappear while the root process is being replaced.
    }
  }

  clearPrivilegedMonitor() {
    if (this.privilegedMonitor) {
      clearInterval(this.privilegedMonitor);
      this.privilegedMonitor = null;
    }
  }

  emit(type, payload = {}) {
    this.onEvent({ type, at: Date.now(), ...payload });
  }

  pushLog(line) {
    const text = String(line).trim();
    if (!text) return;
    const entry = {
      id: `${Date.now()}-${this.logs.length}`,
      at: Date.now(),
      line: text,
    };
    this.logs.push(entry);
    if (this.logs.length > 500) this.logs.splice(0, this.logs.length - 500);
    this.emit("log", entry);
  }

  clearLogs() {
    this.logs = [];
    this.emit("logs-cleared");
    return { ok: true };
  }

  async start({
    profilePath,
    mixedPort,
    controllerPort,
    secret,
    defaultNode,
    tun = false,
  } = {}) {
    if (this.isRunning()) {
      return { ok: true, alreadyRunning: true, status: this.status };
    }
    if (this.starting) {
      return { ok: false, error: "内核正在启动", status: this.status };
    }

    this.starting = true;
    this.lastError = null;
    const core = DEFAULT_PATHS.core;
    const selectedProfile = profilePath || DEFAULT_PATHS.partyCurrentProfile;
    const port = Number(mixedPort || 7890);
    const controller = `127.0.0.1:${Number(controllerPort || 9090)}`;

    try {
      if (!exists(core)) {
        throw new Error(`未找到 mihomo 内核：${core}`);
      }
      if (!exists(selectedProfile)) {
        throw new Error(`未找到可加载的 Clash 配置：${selectedProfile}`);
      }
      if (!Number.isInteger(port) || port < 1024 || port > 65535) {
        throw new Error("mixed 端口必须是 1024 到 65535 之间的整数");
      }

      const runtimeDir = path.join(RUNTIME_ROOT, "runtime");
      removeStaleRuntimeFiles(runtimeDir);
      const runtimeProfile = path.join(runtimeDir, "runtime.yaml");
      const source = YAML.parse(fs.readFileSync(selectedProfile, "utf8")) || {};
      const runtimeObject = {
        ...source,
        "mixed-port": port,
        "external-controller": controller,
        secret: secret || "",
      };
      this.tun = { enabled: Boolean(tun), error: null };
      const runtime = YAML.stringify(
        tun ? applyTunOptions(runtimeObject, { mixedPort: port }) : runtimeObject,
      );
      fs.writeFileSync(runtimeProfile, runtime, { mode: 0o600 });

      this.profilePath = selectedProfile;
      this.runtimeProfile = runtimeProfile;
      this.controller = controller;
      this.secret = secret || "";
      this.mixedPort = port;
      this.trafficSample = null;
      this.proxyMap = null;
      this.expectedExit = false;
      this.stopRequested = false;
      this.privilegedPid = null;
      this.privilegedLogOffset = 0;

      this.pushLog(`加载配置：${path.basename(selectedProfile)}`);
      if (tun) {
        const runtimeLog = path.join(runtimeDir, "runtime.log");
        const runtimePid = path.join(runtimeDir, "runtime.pid");
        const command = [
          `/bin/rm -f ${quoteShell(runtimeLog)} ${quoteShell(runtimePid)};`,
          `${quoteShell(core)} -f ${quoteShell(runtimeProfile)} -d ${quoteShell(CORE_WORK_DIR)} > ${quoteShell(runtimeLog)} 2>&1 < /dev/null &`,
          `pid=$!; echo "$pid" > ${quoteShell(runtimePid)}; cat ${quoteShell(runtimePid)}`,
        ].join(" ");
        const started = await runPrivilegedShell(command);
        const pid = Number(started.output.trim().split(/\r?\n/).at(-1));
        if (started.code !== 0 || !Number.isInteger(pid) || pid <= 0) {
          throw new Error(
            started.output.trim() || "TUN 授权失败或未创建 root 内核",
          );
        }
        this.privilegedPid = pid;
        this.startPrivilegedMonitor(runtimeLog);
        this.pushLog(`TUN 内核已授权启动（pid ${pid}）`);
      } else {
        this.process = spawn(core, ["-f", runtimeProfile, "-d", CORE_WORK_DIR], {
          cwd: CORE_WORK_DIR,
          stdio: ["ignore", "pipe", "pipe"],
        });
      }
      this.startedAt = Date.now();

      const attachStream = (stream, prefix = "") => {
        stream?.on("data", (chunk) => {
          String(chunk)
            .split(/\r?\n/)
            .filter(Boolean)
            .forEach((line) => this.pushLog(`${prefix}${line}`));
        });
      };
      if (this.process) {
        attachStream(this.process.stdout);
        attachStream(this.process.stderr);
        this.process.once("error", (error) => {
          this.lastError = `内核进程错误：${error.message}`;
          this.pushLog(this.lastError);
          this.emit("core-error", { error: this.lastError });
        });
        this.process.once("exit", (code, signal) => {
          const expected = this.expectedExit;
          const stopRequested = this.stopRequested;
          this.pushLog(`内核已退出（${signal || code}）`);
          this.process = null;
          this.startedAt = null;
          this.starting = false;
          this.stopRequested = false;
          if (!expected) this.lastError = `内核意外退出（${signal || code}）`;
          if (
            !stopRequested &&
            this.systemProxy.enabled &&
            this.systemProxy.managedBy === "tangline"
          ) {
            this.setSystemProxy(false)
              .then((result) => {
                if (!result.ok) this.emit("system-proxy-error", { error: result.error });
              })
              .catch((error) =>
                this.emit("system-proxy-error", { error: error.message }),
              );
          }
          this.emit("core-stopped", {
            code,
            signal,
            expected,
            stopRequested,
            error: this.lastError,
            systemProxy: { ...this.systemProxy },
          });
        });
      }

      for (let attempt = 0; attempt < 32; attempt += 1) {
        await sleep(250);
        try {
          const version = await this.api("/version");
          const proxyMap = normalizeProxyMap(await this.api("/proxies"));
          const configs = await this.api("/configs");
          this.proxyMap = proxyMap;
          this.mode = configs?.mode || "rule";
          this.tun = {
            enabled: Boolean(configs?.tun?.enable || tun),
            error: null,
          };
          await this.ensureUsableSelection(defaultNode);
          this.emit("core-started", { ...this.status, starting: false, version });
          return { ok: true, status: { ...this.status, starting: false }, version };
        } catch {
          // The controller needs a moment to bind its local port.
        }
      }
      throw new Error("内核已启动，但控制端口未响应");
    } catch (error) {
      this.lastError = error.message;
      this.pushLog(this.lastError);
      await this.terminateProcess();
      this.tun = { enabled: false, error: this.lastError };
      return { ok: false, error: this.lastError, status: this.status };
    } finally {
      this.starting = false;
    }
  }

  async terminateProcess() {
    const child = this.process;
    const pid = this.privilegedPid;
    this.expectedExit = true;
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      for (let attempt = 0; attempt < 18; attempt += 1) {
        if (child.exitCode !== null) break;
        await sleep(100);
      }
      if (child.exitCode === null) child.kill("SIGKILL");
    }
    if (pid) {
      if (isPidRunning(pid)) {
        const stopped = await runPrivilegedShell(
          `kill -TERM ${pid} 2>/dev/null || true; for i in 1 2 3 4 5 6 7 8; do kill -0 ${pid} 2>/dev/null || break; sleep 0.25; done; kill -0 ${pid} 2>/dev/null || true; if kill -0 ${pid} 2>/dev/null; then kill -KILL ${pid}; fi`,
        );
        if (stopped.code !== 0 && isPidRunning(pid)) {
          this.lastError = stopped.output.trim() || "无法停止 root TUN 内核";
          throw new Error(this.lastError);
        }
      }
      this.privilegedPid = null;
      this.clearPrivilegedMonitor();
      this.pushLog("TUN 内核已停止");
    }
    this.process = null;
    this.startedAt = null;
    this.trafficSample = null;
  }

  async stop() {
    if (!this.isRunning()) {
      return { ok: true, status: this.status };
    }
    this.stopRequested = true;
    this.expectedExit = true;
    this.pushLog("正在停止本地内核");
    await this.refreshSystemProxyStatus({
      expectedPort: this.mixedPort,
      ownership: this.currentProxyOwnership(),
    });
    const externalProxy = this.systemProxy.managedBy === "external";
    const proxyUnavailable = !this.systemProxy.available;
    const proxyResult =
      this.systemProxy.enabled && !externalProxy && !proxyUnavailable
        ? await this.setSystemProxy(false)
        : { ok: true, enabled: this.systemProxy.enabled };
    await this.terminateProcess();
    return {
      ok: proxyResult.ok,
      warning: proxyUnavailable
        ? "无法读取系统代理状态，Tangline 未做修改"
        : externalProxy
          ? "其他应用管理的系统代理保持开启，Tangline 未做修改"
          : proxyResult.ok
            ? null
            : "内核已停止，但系统代理未能自动关闭，请到 macOS 网络设置中检查",
      status: this.status,
    };
  }

  headers() {
    return this.secret ? { Authorization: `Bearer ${this.secret}` } : {};
  }

  async api(endpoint, options = {}) {
    if (!this.controller) throw new Error("控制端口尚未连接");
    return request(`http://${this.controller}${endpoint}`, {
      ...options,
      headers: { ...this.headers(), ...(options.headers || {}) },
    });
  }

  async version() {
    return this.api("/version");
  }

  async proxies() {
    const value = await this.api("/proxies");
    this.proxyMap = normalizeProxyMap(value);
    return this.proxyMap;
  }

  async traffic() {
    try {
      const value = await this.api("/connections", { timeout: 1800 });
      const now = Date.now();
      const connections = value?.connections || [];
      const totalUp = Number(value?.uploadTotal) || 0;
      const totalDown = Number(value?.downloadTotal) || 0;
      let up = 0;
      let down = 0;
      if (this.trafficSample) {
        const seconds = Math.max((now - this.trafficSample.at) / 1000, 0.2);
        up = Math.max(0, (totalUp - this.trafficSample.up) / seconds);
        down = Math.max(0, (totalDown - this.trafficSample.down) / seconds);
      }
      this.trafficSample = { at: now, up: totalUp, down: totalDown };
      this.lastTraffic = {
        up,
        down,
        totalUp,
        totalDown,
        connections: connections.length,
      };
      return this.lastTraffic;
    } catch {
      return this.lastTraffic || { up: 0, down: 0, totalUp: 0, totalDown: 0 };
    }
  }

  async connections() {
    return this.api("/connections");
  }

  async findSelectionPath(nodeName) {
    if (!this.proxyMap) await this.proxies();
    const { entries, byName } = this.proxyMap;
    const root = chooseDirectGroup(this.proxyMap, nodeName);
    if (root?.all.includes(nodeName)) {
      return [{ group: root.name, proxy: nodeName }];
    }

    const nodeRegion = this.regionOfName(nodeName);
    const regionGroups = entries.filter((item) => {
      if (!["select", "selector", "url-test", "fallback", "load-balance"].includes(item.type)) {
        return false;
      }
      if (!item.all.length) return false;
      return (
        item.name === nodeRegion ||
        item.name.includes(nodeRegion) ||
        nodeRegion.includes(item.name)
      );
    });
    if (!root) throw new Error("找不到可以切换节点的策略组");

    for (const group of regionGroups) {
      if (root.all.includes(group.name)) {
        return [
          { group: root.name, proxy: group.name },
          { group: group.name, proxy: nodeName },
        ];
      }
    }
    if (root.all.includes(nodeName)) {
      return [{ group: root.name, proxy: nodeName }];
    }
    const parent = entries.find(
      (item) =>
        isSelectableProxy(item) &&
        item.all.some((name) => byName.get(name)?.type !== "select") &&
        item.all.includes(nodeName),
    );
    if (parent) return [{ group: parent.name, proxy: nodeName }];
    throw new Error(
      `${nodeName} 不在当前可切换的策略组中；请先在订阅配置中提供对应地区组`,
    );
  }

  regionOfName(name) {
    if (/香港|HK|Hong/i.test(name)) return "香港";
    if (/日本|JP|Japan/i.test(name)) return "日本";
    if (/新加坡|SG|Singapore/i.test(name)) return "新加坡";
    if (/美国|US|United|洛杉矶|纽约|西雅图|凤凰城/i.test(name)) return "美国";
    if (/台湾|TW|Taiwan/i.test(name)) return "中国台湾";
    if (/英国|UK|London|伦敦/i.test(name)) return "英国";
    if (/韩国|KR|Korea/i.test(name)) return "韩国";
    return "";
  }

  async selectProxy(group, proxy) {
    await this.api(`/proxies/${encodeURIComponent(group)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: proxy }),
    });
    this.proxyMap = null;
    this.emit("proxy-selected", { group, proxy });
    return { ok: true, group, proxy };
  }

  async selectNode(nodeName) {
    if (isPlaceholderProxyName(nodeName)) {
      throw new Error("订阅信息不是可用线路，请选择具体节点");
    }
    const pathItems = await this.findSelectionPath(nodeName);
    for (const item of pathItems) {
      await this.selectProxy(item.group, item.proxy);
      await delay(70);
    }
    return { ok: true, path: pathItems, node: nodeName };
  }

  async currentSelection() {
    if (!this.status.running) return null;
    if (!this.proxyMap) await this.proxies();
    const selectors = this.proxyMap.entries.filter(
      (item) => item.type === "select" || item.type === "selector",
    );
    const root =
      selectors.find((item) => /节点选择|Proxy|代理/.test(item.name)) ||
      selectors.find((item) => item.name !== "GLOBAL");
    if (!root?.now) return null;

    let name = root.now;
    for (let depth = 0; depth < 24; depth += 1) {
      const next = this.proxyMap.byName.get(name);
      if (!next || !next.all.length) {
        return {
          group: root.name,
          tag: name,
          isPlaceholder: isPlaceholderProxyName(name),
        };
      }
      if (!next.now) return null;
      name = next.now;
    }
    return null;
  }

  async ensureUsableSelection(preferredNode) {
    const selection = await this.currentSelection();
    if (!selection?.isPlaceholder) return selection;
    if (!preferredNode || isPlaceholderProxyName(preferredNode)) {
      this.pushLog(`当前线路是订阅信息项：${selection.tag}`);
      return selection;
    }
    try {
      await this.selectNode(preferredNode);
      this.pushLog(`订阅信息项不可转发，已改选：${preferredNode}`);
      return this.currentSelection();
    } catch (error) {
      this.pushLog(`无法改选默认节点：${error.message}`);
      return selection;
    }
  }

  async testDelay(proxy) {
    if (isPlaceholderProxyName(proxy)) {
      throw new Error("订阅信息不是可用线路，无法测速");
    }
    const result = await this.api(
      `/proxies/${encodeURIComponent(proxy)}/delay?timeout=5000&url=${encodeURIComponent("https://www.gstatic.com/generate_204")}`,
      { timeout: 7000 },
    );
    return { delay: result?.delay ?? null, raw: result };
  }

  async setMode(mode) {
    const allowed = new Set(["rule", "global", "direct"]);
    if (!allowed.has(mode)) throw new Error("不支持的代理模式");
    await this.api("/configs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    this.mode = mode;
    return { ok: true, mode };
  }

  async setSystemProxy(enabled) {
    if (enabled && (!this.isRunning() || !this.mixedPort)) {
      return {
        ok: false,
        error: "请先启动内核，再开启系统代理",
        enabled: false,
      };
    }
    const refreshed = await this.refreshSystemProxyStatus({
      expectedPort: this.mixedPort,
      ownership: this.currentProxyOwnership(),
    });
    if (!refreshed.available) {
      return {
        ok: false,
        error: refreshed.error || "无法读取 macOS 系统代理状态",
        enabled: refreshed.enabled,
        available: false,
        managedBy: refreshed.managedBy,
        service: refreshed.service,
        endpoint: refreshed.endpoint,
      };
    }
    if (!enabled && refreshed.managedBy === "external") {
      return {
        ok: false,
        error: "系统代理正由其他应用管理，Tangline 不会关闭它",
        enabled: true,
        available: true,
        managedBy: "external",
        service: refreshed.service,
        endpoint: refreshed.endpoint,
      };
    }
    if (enabled && this.systemProxy.enabled) {
      return {
        ok: false,
        error:
          this.systemProxy.managedBy === "external"
            ? "系统代理正由其他应用管理，请先在对应应用中关闭"
            : "系统代理已由 Tangline 启用",
        enabled: true,
        managedBy: this.systemProxy.managedBy,
        service: this.systemProxy.service,
        endpoint: this.systemProxy.endpoint,
      };
    }
    const service =
      this.systemProxy.service || (await this.activeNetworkService());
    if (!service) {
      return {
        ok: false,
        error: "没有检测到当前正在使用的网络服务",
        enabled: false,
      };
    }
    const commands = enabled
      ? [
          ["networksetup", "-setwebproxy", service, "127.0.0.1", String(this.mixedPort)],
          [
            "networksetup",
            "-setsecurewebproxy",
            service,
            "127.0.0.1",
            String(this.mixedPort),
          ],
          [
            "networksetup",
            "-setsocksfirewallproxy",
            service,
            "127.0.0.1",
            String(this.mixedPort),
          ],
          [
            "networksetup",
            "-setproxybypassdomains",
            service,
            "127.0.0.1",
            "localhost",
            "*.local",
          ],
        ]
      : [
          ["networksetup", "-setwebproxystate", service, "off"],
          ["networksetup", "-setsecurewebproxystate", service, "off"],
          ["networksetup", "-setsocksfirewallproxystate", service, "off"],
        ];
    const result = await runCommandSequence(commands);
    let output = result.output;
    let failure = result.code === 0 ? "" : result.output;
    if (failure) {
      const privileged = await runPrivilegedCommandSequence(commands);
      output += privileged.output;
      if (privileged.code !== 0) {
        failure = privileged.output || failure;
      } else {
        failure = "";
      }
    }
    if (failure) {
      return {
        ok: false,
        error: enabled
          ? "修改系统代理失败；请在 macOS 授权提示中允许操作后重试"
          : "关闭系统代理失败，请到 macOS 网络设置中手动关闭",
        detail: String(failure).trim(),
        service,
        enabled: this.systemProxy.enabled,
      };
    }
    this.systemProxy = {
      enabled,
      available: true,
      service,
      managedBy: enabled ? "tangline" : null,
      endpoint: enabled
        ? {
            server: "127.0.0.1",
            port: this.mixedPort,
            types: ["HTTP", "HTTPS", "SOCKS"],
          }
        : null,
      error: null,
    };
    this.emit("system-proxy-changed", { ...this.systemProxy });
    return { ok: true, service, enabled };
  }

  async refreshSystemProxyStatus({ expectedPort, ownership } = {}) {
    const service =
      this.systemProxy.service || (await this.activeNetworkService());
    if (!service) {
      this.systemProxy = {
        enabled: false,
        available: false,
        service: null,
        managedBy: null,
        endpoint: null,
        error: "没有检测到当前正在使用的网络服务",
      };
      return { ...this.systemProxy };
    }

    const [web, secureWeb, socks] = await Promise.all([
      runCommand("networksetup", ["-getwebproxy", service]),
      runCommand("networksetup", ["-getsecurewebproxy", service]),
      runCommand("networksetup", ["-getsocksfirewallproxy", service]),
    ]);
    const failed = [web, secureWeb, socks].find((result) => result.code !== 0);
    if (failed) {
      this.systemProxy = {
        enabled: false,
        available: false,
        service,
        managedBy: null,
        endpoint: null,
        error: "无法读取 macOS 系统代理状态",
      };
      return { ...this.systemProxy };
    }

    this.systemProxy = classifySystemProxy({
      service,
      web: parseNetworkProxy(web.output),
      secureWeb: parseNetworkProxy(secureWeb.output),
      socks: parseNetworkProxy(socks.output),
      expectedPort: Number(expectedPort) || this.mixedPort,
      ownership: ownership || this.currentProxyOwnership(),
    });
    this.systemProxy.error = null;
    return { ...this.systemProxy };
  }

  currentProxyOwnership() {
    return proxyOwnershipFromStatus(this.systemProxy);
  }

  async activeNetworkService() {
    const services = await this.listNetworkServices();
    if (!services.length) return null;

    const route = await runCommand("route", ["-n", "get", "default"]);
    const interfaceName = route.output.match(/interface:\s*(\S+)/)?.[1];
    if (interfaceName) {
      const ports = await runCommand("networksetup", [
        "-listallhardwareports",
      ]);
      const blocks = ports.output.split(/\n\s*\n/);
      const block = blocks.find((item) =>
        item.includes(`Device: ${interfaceName}`),
      );
      const service = block?.match(/Hardware Port:\s*(.+)/)?.[1]?.trim();
      if (service && services.includes(service)) return service;
    }

    return (
      services.find((service) => /Wi-Fi|Ethernet|Thunderbolt/i.test(service)) ||
      services[0]
    );
  }

  async listNetworkServices() {
    const result = await runCommand("networksetup", ["-listallnetworkservices"]);
    if (result.code !== 0) return [];
    return result.output
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("*"));
  }
}

function quoteShell(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

function runPrivilegedShell(command) {
  return runCommand("osascript", [
    "-e",
    `do shell script ${JSON.stringify(command)} with administrator privileges`,
  ]);
}

function runPrivilegedCommandSequence(commands) {
  const command = commands
    .map((args) => args.map(quoteShell).join(" "))
    .join(" && ");
  return runCommand("osascript", [
    "-e",
    `do shell script ${JSON.stringify(command)} with administrator privileges`,
  ]);
}

function runCommandSequence(commands) {
  return runCommand("/bin/sh", [
    "-c",
    commands.map((args) => args.map(quoteShell).join(" ")).join(" && "),
  ]);
}

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("error", (error) =>
      resolve({ code: 1, output: `${output}${error.message}` }),
    );
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}
