import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = process.env.OUT ?? "/mnt/documents/MSK-Afiliados.mp4";
const range = process.env.RANGE ? process.env.RANGE.split("-").map(Number) : null;

const bundled = await bundle({ entryPoint: path.resolve(__dirname, "../src/index.ts"), webpackOverride: (c) => c });

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

const composition = await selectComposition({ serveUrl: bundled, id: "afiliados", puppeteerInstance: browser });

await renderMedia({
  composition,
  serveUrl: bundled,
  codec: "h264",
  audioCodec: "mp3",
  outputLocation: out,
  puppeteerInstance: browser,
  concurrency: 1,
  delayRenderTimeoutInMilliseconds: 120000,
  ...(range ? { frameRange: [range[0], range[1]] } : {}),
  onProgress: ({ progress }) => {
    if (Math.round(progress * 100) % 10 === 0) console.log("progress", Math.round(progress * 100));
  },
});

await browser.close({ silent: false });
console.log("done");
