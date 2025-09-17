import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import lighthouse from "lighthouse";
import { launch as chromeLaunch } from "chrome-launcher";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "urls.json"), "utf8"));
const base = process.env.BASE_URL || cfg.baseUrl;
const outDir = path.join(root, "out");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const summaries = [];
for (const p of cfg.pages) {
  const url = new URL(p, base).toString();
  const chrome = await chromeLaunch({ chromeFlags: ["--headless", "--no-sandbox"] });
  try {
    const opts = { port: chrome.port, logLevel: "error", output: "json" };
    const runnerResult = await lighthouse(url, opts);
    const lhr = runnerResult.lhr;
    const slug = p.replace(/[^a-z0-9]+/gi, "_") || "home";
    fs.writeFileSync(path.join(outDir, `lighthouse-${slug}.json`), JSON.stringify(lhr, null, 2));
    const s = {
      page: p,
      performance: lhr.categories.performance?.score ?? null,
      accessibility: lhr.categories.accessibility?.score ?? null,
      seo: lhr.categories.seo?.score ?? null,
      bestPractices: lhr.categories["best-practices"]?.score ?? null,
    };
    summaries.push(s);
  } finally {
    await chrome.kill();
  }
}
fs.writeFileSync(path.join(outDir, "lighthouse-summary.json"), JSON.stringify(summaries, null, 2));
console.log("Lighthouse done for", summaries.length, "pages");
