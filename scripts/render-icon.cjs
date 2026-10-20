const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const [source, destination, widthValue, heightValue] = process.argv.slice(2);
const width = Number(widthValue);
const height = Number(heightValue);

if (!source || !destination || !width || !height) {
  throw new Error("Usage: render-icon.cjs <source> <destination> <width> <height>");
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    width,
    height,
    useContentSize: true,
    transparent: true,
    frame: false,
    backgroundColor: "#00000000",
    webPreferences: {
      backgroundThrottling: false,
      offscreen: true,
    },
  });

  await window.loadFile(path.resolve(source));
  const image = await window.webContents.capturePage();
  const resized = image.resize({ width, height, quality: "best" });
  fs.writeFileSync(destination, resized.toPNG());
  window.destroy();
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
