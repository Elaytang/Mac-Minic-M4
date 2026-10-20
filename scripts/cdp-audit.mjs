import fs from "node:fs";

const baseUrl = "http://127.0.0.1:9223/json/list";
const targets = await fetch(baseUrl).then((response) => response.json());
const target = targets.find((item) => item.type === "page");
if (!target) throw new Error("No Tangline page target");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 0;
const pending = new Map();
const diagnostics = [];
socket.addEventListener("message", async (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Network.responseReceived") {
    diagnostics.push({
      type: "response",
      text: `${message.params.response.url} ${message.params.response.status} ${message.params.response.mimeType}`,
    });
    if (message.params.response.url.endsWith("/dist/index.html")) {
      try {
        const body = await send("Network.getResponseBody", {
          requestId: message.params.requestId,
        });
        diagnostics.push({
          type: "index-body",
          text: body.base64Encoded
            ? Buffer.from(body.body, "base64").subarray(0, 240).toString("utf8")
            : body.body.slice(0, 240),
        });
      } catch (error) {
        diagnostics.push({ type: "index-body-error", text: error.message });
      }
    }
  }
  if (message.method === "Network.loadingFailed") {
    diagnostics.push({
      type: "load-failed",
      text: `${message.params.errorText} ${message.params.blockedReason || ""}`,
    });
  }
  if (message.method === "Log.entryAdded") {
    diagnostics.push({
      type: message.params.entry?.level,
      text: message.params.entry?.text,
    });
  }
  if (message.method === "Runtime.consoleAPICalled") {
    diagnostics.push({
      type: message.params.type,
      text: message.params.args?.map((item) => item.value ?? item.description ?? "").join(" "),
    });
  }
  if (message.method === "Runtime.exceptionThrown") {
    diagnostics.push({
      type: "exception",
      text: message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text,
    });
  }
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});

function send(method, params = {}, timeoutMs = 15000) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, timeoutMs);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function setViewport(width, height) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: false,
    screenWidth: width,
    screenHeight: height,
  });
  await sleep(500);
}

async function waitForNavigation() {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const ready = await evaluate(`Boolean(document.querySelector("#primary-navigation button"))`);
    if (ready) return;
    await sleep(250);
  }
  throw new Error("Navigation did not mount");
}

async function dumpBootState(label) {
  console.log(label, await evaluate(`(() => ({
    readyState: document.readyState,
    rootClass: document.documentElement.className,
    hasDesktop: Boolean(window.tangline?.isElectron),
    rootExists: Boolean(document.getElementById('root')),
    rootHtml: document.getElementById('root')?.innerHTML.slice(0, 1000) || '',
    scripts: [...document.scripts].map((script) => script.src),
    head: document.head?.outerHTML.slice(0, 1200) || '',
    bodyStart: document.body?.outerHTML.slice(0, 1200) || '',
    resources: performance.getEntriesByType('resource').map((entry) => ({
      name: entry.name,
      type: entry.initiatorType,
      duration: entry.duration,
    })),
  }))()`), { diagnostics: diagnostics.slice(0, 10) });
}

async function openPage(label) {
  await evaluate(`(() => {
    const button = [...document.querySelectorAll("#primary-navigation button")]
      .find((item) => item.textContent.trim().startsWith(${JSON.stringify(label)}));
    if (!button) throw new Error("Navigation item not found");
    button.click();
  })()`);
  await sleep(900);
}

async function audit(name, width, height) {
  console.error(`audit: ${width}×${height} ${name}`);
  await setViewport(width, height);
  await openPage(name);
  const result = await evaluate(`(() => {
    const visible = [...document.querySelectorAll("body *")].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
    const clipped = visible.filter((element) => {
      const rect = element.getBoundingClientRect();
      if (element.closest(".connection-table")) return false;
      const sidebar = element.closest(".sidebar");
      if (sidebar && !sidebar.classList.contains("is-open")) return false;
      return rect.right > window.innerWidth + 1 || rect.left < -1;
    }).slice(0, 20).map((element) => ({
      tag: element.tagName,
      className: String(element.className),
      text: element.textContent.trim().slice(0, 80),
      left: Math.round(element.getBoundingClientRect().left),
      right: Math.round(element.getBoundingClientRect().right),
    }));
    const brokenButtons = [...document.querySelectorAll("button")].filter((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && (
        button.scrollWidth > button.clientWidth + 1 ||
        button.scrollHeight > button.clientHeight + 1
      );
    }).map((button) => ({
      label: button.textContent.trim().slice(0, 60),
      size: [button.clientWidth, button.clientHeight],
      scroll: [button.scrollWidth, button.scrollHeight],
    }));
    return {
      title: document.querySelector(".page-header h1")?.textContent || null,
      viewport: [window.innerWidth, window.innerHeight],
      navigationCount: document.querySelectorAll("#primary-navigation .nav__item").length,
      navigationVisible: [...document.querySelectorAll("#primary-navigation .nav__item")].every((item) => {
        const rect = item.getBoundingClientRect();
        const style = getComputedStyle(item);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      }),
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      clipped,
      brokenButtons,
    };
  })()`);
  let shot;
  let screenshot = true;
  try {
    shot = await send(
      "Page.captureScreenshot",
      { format: "png", fromSurface: false },
      5000,
    );
  } catch {
    try {
      shot = await send("Page.captureScreenshot", { format: "png" }, 5000);
    } catch {
      screenshot = false;
    }
  }
  const shotDir = "/private/tmp/tangline-shots-final";
  fs.mkdirSync(shotDir, { recursive: true });
  if (shot?.data) {
    fs.writeFileSync(`${shotDir}/${width}-${name}.png`, Buffer.from(shot.data, "base64"));
  }
  return { ...result, screenshot };
}

await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Network.enable");
await send("Page.reload");
await sleep(1500);
await dumpBootState("boot:");
await waitForNavigation();
console.log(await evaluate("({href: location.href, title: document.title, readyState: document.readyState, root: document.getElementById('root')?.innerHTML.slice(0, 500), body: document.body.innerHTML.slice(0, 500)})"));

const results = [];
const labels = ["总览", "节点", "订阅", "路由规则", "连接", "日志", "设置"];
  for (const width of [1320, 760]) {
    const height = width === 1320 ? 860 : 620;
  for (const label of labels) {
    results.push(await audit(label, width, height));
  }
}

socket.close();
console.log(JSON.stringify({ results, diagnostics: diagnostics.slice(0, 20) }, null, 2));
