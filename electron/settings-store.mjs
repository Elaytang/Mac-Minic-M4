import fs from "node:fs";
import path from "node:path";

const defaults = {
  autoConnect: false,
  tunEnabled: false,
  favorites: [],
  recent: [],
  proxyOwnership: null,
};

function cleanList(value, limit) {
  if (!Array.isArray(value)) return null;
  return [
    ...new Set(
      value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.slice(0, 200)),
    ),
  ].slice(0, limit);
}

function cleanProxyOwnership(value) {
  if (!value || value.enabled !== true) return null;
  const port = Number(value.port);
  if (
    typeof value.service !== "string" ||
    !value.service.trim() ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    return null;
  }
  return {
    enabled: true,
    service: value.service.trim().slice(0, 120),
    server: "127.0.0.1",
    port,
    enabledAt: Number.isFinite(Number(value.enabledAt))
      ? Number(value.enabledAt)
      : Date.now(),
  };
}

export class SettingsStore {
  constructor(file) {
    this.file = file;
    this.data = this.read();
  }

  read() {
    try {
      const value = JSON.parse(fs.readFileSync(this.file, "utf8"));
      return {
        ...defaults,
        autoConnect:
          typeof value?.autoConnect === "boolean"
            ? value.autoConnect
            : defaults.autoConnect,
        favorites: cleanList(value?.favorites, 300) || [],
        recent: cleanList(value?.recent, 12) || [],
        proxyOwnership: cleanProxyOwnership(value?.proxyOwnership),
        tunEnabled:
          typeof value?.tunEnabled === "boolean"
            ? value.tunEnabled
            : defaults.tunEnabled,
      };
    } catch {
      return { ...defaults };
    }
  }

  write(next) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const temporary = `${this.file}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, {
      mode: 0o600,
    });
    fs.renameSync(temporary, this.file);
  }

  get() {
    return {
      ...this.data,
      favorites: [...this.data.favorites],
      recent: [...this.data.recent],
      proxyOwnership: this.data.proxyOwnership
        ? { ...this.data.proxyOwnership }
        : null,
    };
  }

  update(patch = {}) {
    const next = { ...this.data };
    if (typeof patch.autoConnect === "boolean") {
      next.autoConnect = patch.autoConnect;
    }
    if (typeof patch.tunEnabled === "boolean") {
      next.tunEnabled = patch.tunEnabled;
    }
    const favorites = cleanList(patch.favorites, 300);
    if (favorites) next.favorites = favorites;
    const recent = cleanList(patch.recent, 12);
    if (recent) next.recent = recent;
    if (Object.prototype.hasOwnProperty.call(patch, "proxyOwnership")) {
      next.proxyOwnership = cleanProxyOwnership(patch.proxyOwnership);
    }
    this.data = next;
    this.write(next);
    return this.get();
  }
}
