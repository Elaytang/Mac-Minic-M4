import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import electron from "electron";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "assets");
const iconset = path.join(assets, "AppIcon.iconset");

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} failed (${result.status})\n${result.stderr || result.stdout}`,
    );
  }
}

async function render(source, destination, width, height) {
  run(electron, [
    path.join(root, "scripts", "render-icon.cjs"),
    path.join(assets, source),
    path.join(assets, destination),
    String(width),
    String(height),
  ]);
}

function ensurePng(file, width, height) {
  const result = spawnSync(
    "sips",
    ["-g", "pixelWidth", "-g", "pixelHeight", file],
    { encoding: "utf8" },
  );
  if (
    result.status !== 0 ||
    !new RegExp(`pixelWidth:\\s*${width}\\b`).test(result.stdout) ||
    !new RegExp(`pixelHeight:\\s*${height}\\b`).test(result.stdout)
  ) {
    throw new Error(
      `Invalid image dimensions: ${file}\n${result.stderr || result.stdout}`,
    );
  }
}

if (process.platform !== "darwin") {
  throw new Error("This icon build script currently requires macOS tools.");
}
await render("tangline-icon.svg", "tangline-icon-1024.png", 1024, 1024);
await render("trayTemplate.svg", "trayTemplate@2x.png", 36, 36);
run("sips", [
  "-z",
  "18",
  "18",
  path.join(assets, "trayTemplate@2x.png"),
  "--out",
  path.join(assets, "trayTemplate.png"),
]);
ensurePng(path.join(assets, "tangline-icon-1024.png"), 1024, 1024);
ensurePng(path.join(assets, "trayTemplate@2x.png"), 36, 36);
ensurePng(path.join(assets, "trayTemplate.png"), 18, 18);

fs.rmSync(iconset, { recursive: true, force: true });
fs.mkdirSync(iconset, { recursive: true });
for (const [size, name] of [
  [16, "icon_16x16.png"],
  [32, "icon_16x16@2x.png"],
  [32, "icon_32x32.png"],
  [64, "icon_32x32@2x.png"],
  [128, "icon_128x128.png"],
  [256, "icon_128x128@2x.png"],
  [256, "icon_256x256.png"],
  [512, "icon_256x256@2x.png"],
  [512, "icon_512x512.png"],
  [1024, "icon_512x512@2x.png"],
]) {
  run("sips", [
    "-z",
    String(size),
    String(size),
    path.join(assets, "tangline-icon-1024.png"),
    "--out",
    path.join(iconset, name),
  ]);
}
run("iconutil", [
  "-c",
  "icns",
  iconset,
  "-o",
  path.join(assets, "AppIcon.icns"),
]);
fs.rmSync(iconset, { recursive: true, force: true });

console.log("Tangline icons built in assets/");
