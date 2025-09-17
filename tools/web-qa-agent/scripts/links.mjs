import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LinkChecker } from "linkinator";
import dayjs from "dayjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "urls.json"), "utf8"));
const base = process.env.BASE_URL || cfg.baseUrl;
const outDir = path.join(root, "out");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const checker = new LinkChecker();
const results = await checker.check({ path: base, recurse: true, linksToIgnore: ["mailto:*", "tel:*"], retry: true });
const out = {
  base,
  checkedAt: dayjs().toISOString(),
  passed: results.passed,
  urlCount: results.links.length,
  broken: results.links.filter((l) => l.state !== "OK").map((l) => ({ url: l.url, state: l.state, status: l.status })),
};
fs.writeFileSync(path.join(outDir, "links.json"), JSON.stringify(out, null, 2));
console.log("Links checked:", out.urlCount, "broken:", out.broken.length);
