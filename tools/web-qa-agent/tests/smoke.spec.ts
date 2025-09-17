import { test, expect } from "@playwright/test";
import fs from "node:fs";

const cfgPath = new URL("../urls.json", import.meta.url);
const raw = fs.readFileSync(cfgPath).toString();
const urls = JSON.parse(raw);

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
  test(`smoke: ${p}`, async ({ page, baseURL }) => {
    const url = new URL(p, baseURL!).toString();
    const resp = await page.goto(url, { waitUntil: "domcontentloaded" });
    expect(resp, "navigation should return a response").toBeTruthy();
    expect(resp!.status(), "HTTP status is OK-ish").toBeLessThan(400);
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
}
