import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dayjs from "dayjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "out");
const urls = JSON.parse(fs.readFileSync(path.join(root, "urls.json"), "utf8"));

function loadJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

const lhSummary = loadJSON(path.join(outDir, "lighthouse-summary.json")) || [];
const links = loadJSON(path.join(outDir, "links.json")) || { broken: [], urlCount: 0 };
const axeFiles = fs.readdirSync(outDir).filter((f) => f.startsWith("axe-") && f.endsWith(".json"));
const axe = axeFiles.map((f) => ({ file: f, data: loadJSON(path.join(outDir, f)) }));

let md = "";
md += `# Web QA Report\n\n`;
md += `Date: ${dayjs().format("YYYY-MM-DD HH:mm")}\n\n`;
md += `Base URL: ${process.env.BASE_URL || urls.baseUrl}\n\n`;

md += `## Lighthouse\n\n`;
if (lhSummary.length === 0) md += `No Lighthouse results found.\n\n`;
for (const s of lhSummary) {
  md += `- ${s.page}: perf ${(s.performance ?? 0) * 100 | 0}, a11y ${(s.accessibility ?? 0) * 100 | 0}, SEO ${(s.seo ?? 0) * 100 | 0}, best ${(s.bestPractices ?? 0) * 100 | 0}\n`;
}
md += `\n`;

md += `## Link Check\n\n`;
md += `- Total URLs: ${links.urlCount}\n`;
md += `- Broken: ${links.broken?.length || 0}\n`;
if ((links.broken?.length || 0) > 0) {
  for (const b of links.broken.slice(0, 50)) md += `  - ${b.status || b.state}: ${b.url}\n`;
  if (links.broken.length > 50) md += `  - ...and ${links.broken.length - 50} more\n`;
}
md += `\n`;

md += `## Axe Accessibility\n\n`;
if (axe.length === 0) md += `No Axe files found.\n\n`;
for (const a of axe) {
  const v = a.data?.violations?.length || 0;
  md += `- ${a.file}: ${v} violations\n`;
}
md += `\n`;

fs.writeFileSync(path.join(outDir, "report.md"), md);
console.log("Wrote", path.join(outDir, "report.md"));
