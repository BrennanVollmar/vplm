import { defineConfig } from "@playwright/test";
import fs from "node:fs";

const cfgPath = new URL("./urls.json", import.meta.url);
const raw = fs.readFileSync(cfgPath).toString();
const urls = JSON.parse(raw);
const base = process.env.BASE_URL || urls.baseUrl || "https://localhost:5173";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: {
    baseURL: base,
    trace: "on-first-retry",
  },
  reporter: [["list"]],
});
