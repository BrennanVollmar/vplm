import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";

const cfgPath = new URL("../urls.json", import.meta.url);
const raw = fs.readFileSync(cfgPath).toString();
const urls = JSON.parse(raw);
const outDir = path.resolve(process.cwd(), 'out');

test.beforeEach(async ({ page, baseURL }) => {
  const allowed = new URL(baseURL!).origin;
  await page.route('**/*', route => {
    const reqUrl = route.request().url();
    try {
      const origin = new URL(reqUrl).origin;
      if (origin === allowed) return route.continue();
    } catch {}
    return route.abort();
  });
});

for (const p of urls.pages as string[]) {
  test(`a11y: ${p}`, async ({ page, baseURL }) => {
    const url = new URL(p, baseURL!).toString();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const results = await new AxeBuilder({ page }).analyze();
    const file = path.join(outDir, `axe-${p.replace(/[^a-z0-9]+/gi, "_") || "home"}.json`);
    fs.writeFileSync(file, JSON.stringify(results, null, 2));
  });
}
