import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frames = process.argv.slice(2).map(Number);

const serveUrl = await bundle({ entryPoint: path.resolve(__dirname, "../src/index.ts") });
const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});
const composition = await selectComposition({ serveUrl, id: "afiliados", puppeteerInstance: browser });
console.log("duration", composition.durationInFrames);
for (const f of frames) {
  await renderStill({
    composition,
    serveUrl,
    frame: f,
    output: `/tmp/afl/f${f}.png`,
    puppeteerInstance: browser,
  });
  console.log("still", f);
}
await browser.close({ silent: false });
