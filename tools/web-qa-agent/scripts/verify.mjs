import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const outDir = path.join(root, 'out');
if (!fs.existsSync(outDir)) throw new Error('out directory missing');
const report = path.join(outDir, 'report.md');
if (!fs.existsSync(report)) throw new Error('report.md missing');
const stat = fs.statSync(report);
if (stat.size <= 20) throw new Error('report.md seems empty');

// Check duplicates by basename prefix
const files = fs.readdirSync(outDir);
const baseCounts = new Map();
for (const f of files) {
  const key = f.replace(/[-.].*$/, '');
  baseCounts.set(key, (baseCounts.get(key) || 0) + 1);
}
const dups = [...baseCounts.entries()].filter(([k,v]) => v > 5); // arbitrary high threshold
if (dups.length) {
  console.warn('Possible duplicate outputs:', dups);
}
console.log('Verify OK: report present and non-empty.');
