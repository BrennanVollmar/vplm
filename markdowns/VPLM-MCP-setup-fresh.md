
# VPLM MCP – Fresh Setup (From Zero)

This Markdown contains a **single PowerShell script** that will scaffold a clean MCP server under `./mcp`, install everything, generate `.env`, and wire up root npm scripts. It **auto-picks a free port** and can **generate an auth token**.

> **Run inside your repo root (`VPLM/`) in VS Code PowerShell (`PS>`).**

---

## 🚀 One-Command Bootstrap (PowerShell)

Copy/paste the block below into your terminal:

```powershell
# ===== VPLM MCP — Fresh One-Shot Setup =====
# Safe to run on a totally clean repo (or after deleting prior mcp files).

function Get-FreePort {
  param([int]$Start = 7860)
  $port = $Start
  while ($true) {
    try {
      $l = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
      $l.Start(); $l.Stop()
      return $port
    } catch { $port++ }
  }
}

Write-Host "`n🔧 Starting fresh VPLM MCP setup in $(Get-Location)`n"

# --- Inputs ---
$repoRoot = Read-Host "Repo root to expose (Enter = current folder)"
if (-not $repoRoot) { $repoRoot = (Get-Location).Path }

$preferredPort = Read-Host "Preferred port (Enter = 7860; will auto-pick if busy)"
if (-not $preferredPort) { $preferredPort = 7860 }
$freePort = Get-FreePort -Start [int]$preferredPort

$authToken = Read-Host "Auth token (Enter = auto-generate)"
if (-not $authToken) {
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $bytes = New-Object byte[] 16
  $rng.GetBytes($bytes)
  $authToken = ([System.BitConverter]::ToString($bytes)).Replace("-", "").ToLower()
  Write-Host " → Generated token: $authToken"
}

# --- Create mcp/ cleanly ---
$mcpDir = Join-Path (Get-Location) "mcp"
if (Test-Path $mcpDir) {
  Write-Host "Cleaning existing .\mcp contents…"
  Remove-Item -Recurse -Force "$mcpDir\*" -ErrorAction SilentlyContinue
} else {
  New-Item -ItemType Directory -Force -Path $mcpDir | Out-Null
}
Set-Location $mcpDir

# --- Initialize npm package (or reuse) ---
if (-not (Test-Path "package.json")) {
  npm init -y | Out-Null
}

Write-Host "⬇️  Installing dependencies…"
npm install @modelcontextprotocol/sdk ws dotenv zod | Out-Null

# --- .env & example ---
$envText = @"
AUTH_TOKEN=$authToken
PORT=$freePort
REPO_ROOT=$repoRoot
"@
$envText | Set-Content -Path ".env" -Encoding UTF8
$envText | Set-Content -Path ".env.example" -Encoding UTF8

# --- .gitignore ---
@"node_modules
.env
.DS_Store
"@ | Set-Content -Path ".gitignore" -Encoding UTF8

# --- server.mjs (full, ESM) ---
@"
import 'dotenv/config';
import { WebSocketServer } from 'ws';
import os from 'os';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebSocketServerTransport } from '@modelcontextprotocol/sdk/server/websocket.js';

const NAME = 'VPLM MCP';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const PORT = Number(process.env.PORT || 7860);
const ROOT = process.env.REPO_ROOT || process.cwd();

// ---------- helpers ----------
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');
const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out); else out.push(full);
  }
  return out;
};
const guessMime = (p) => (/\.(md|markdown)$/i.test(p) ? 'text/markdown' : 'text/plain');

const lanUrls = (port) => {
  const nets = os.networkInterfaces();
  const urls = [];
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (!n.internal && n.family === 'IPv4') urls.push(`ws://${n.address}:${port}`);
    }
  }
  return urls;
};

// ---------- MCP server ----------
const server = new McpServer({ name: NAME, version: '1.0.0' });

// list_files(dir?, pattern?)
server.tool('list_files', { dir: { type: 'string', optional: true }, pattern: { type: 'string', optional: true } }, async ({ dir, pattern }) => {
  const base = dir ? path.resolve(ROOT, dir) : ROOT;
  let files = walk(base);
  if (pattern) {
    const rx = new RegExp(pattern.replace(/\./g, '\\.').replace(/\*/g, '.*'), 'i');
    files = files.filter((f) => rx.test(f));
  }
  return { files: files.map((f) => path.relative(ROOT, f)) };
});

// read_file(path) with 512KB cap
server.tool('read_file', { path: { type: 'string' } }, async ({ path: rel }) => {
  try {
    const abs = path.resolve(ROOT, rel);
    const text = fs.readFileSync(abs, 'utf8');
    if (text.length > 512 * 1024) return { error: 'File too large (512KB cap)' };
    return { path: rel, mimeType: guessMime(abs), text };
  } catch (e) {
    return { error: String(e?.message || e) };
  }
});

// search_text(query, exts?)
server.tool('search_text', { query: { type: 'string' }, exts: { type: 'string', optional: true } }, async ({ query, exts }) => {
  const allow = exts ? exts.split(',').map((s) => s.trim().toLowerCase()) : null;
  const results = [];
  for (const f of walk(ROOT)) {
    if (allow && !allow.some((x) => f.toLowerCase().endsWith(x))) continue;
    const txt = fs.readFileSync(f, 'utf8');
    if (txt.toLowerCase().includes(query.toLowerCase())) {
      results.push({ id: sha1(f), path: path.relative(ROOT, f), snippet: txt.slice(0, 200).replace(/\s+/g, ' ') });
    }
  }
  return { results };
});

// md_index(): markdown files overview
server.tool('md_index', {}, async () => {
  const items = [];
  for (const f of walk(ROOT)) {
    if (/\.(md|markdown)$/i.test(f)) {
      const t = fs.readFileSync(f, 'utf8');
      const title = (t.match(/^#\s+(.+)$/m)?.[1] ?? path.basename(f)).trim();
      items.push({ id: sha1(f), path: path.relative(ROOT, f), title, snippet: t.slice(0, 200).replace(/\s+/g, ' ') });
    }
  }
  return { items };
});

// repo_info()
server.tool('repo_info', {}, async () => {
  const files = walk(ROOT);
  const bytes = files.reduce((n, f) => n + fs.statSync(f).size, 0);
  return { root: ROOT, files: files.length, bytes };
});

// ---- REQUIRED for ChatGPT Search/Deep Research ----
// search(query) returns {id,title,snippet}; fetch(id) returns {uri,mimeType,text}
server.tool('search', { query: { type: 'string' } }, async ({ query }) => {
  const out = [];
  for (const f of walk(ROOT)) {
    if (!/\.(md|markdown|txt)$/i.test(f)) continue;
    const txt = fs.readFileSync(f, 'utf8');
    if (txt.toLowerCase().includes(query.toLowerCase())) {
      const title = (txt.match(/^#\s+(.+)$/m)?.[1] ?? path.basename(f)).trim();
      out.push({ id: sha1(f), title, snippet: txt.slice(0, 200).replace(/\s+/g, ' ') });
    }
  }
  return { results: out };
});

server.tool('fetch', { id: { type: 'string' } }, async ({ id }) => {
  for (const f of walk(ROOT)) {
    if (sha1(f) === id) {
      const text = fs.readFileSync(f, 'utf8');
      return { uri: 'file://' + f, mimeType: guessMime(f), text };
    }
  }
  return { error: 'Not found' };
});

// ---------- WebSocket transport with Bearer auth ----------
const wss = new WebSocketServer({
  port: PORT,
  verifyClient: (info, done) => {
    if (!AUTH_TOKEN) return done(true); // dev: no auth
    const h = info.req.headers['authorization'];
    if (h === `Bearer ${AUTH_TOKEN}`) return done(true);
    return done(false, 401, 'Unauthorized');
  }
});
wss.on('connection', (socket) => {
  server.connect(new WebSocketServerTransport(socket));
});

console.log(`${NAME} listening on ws://localhost:${PORT}`);
for (const u of lanUrls(PORT)) console.log('LAN: ' + u);
"@ | Set-Content -Path "server.mjs" -Encoding UTF8

# --- mcp/package.json scripts ---
# ensure dev/start present and type=module
$json = Get-Content -Raw -Path "package.json" | ConvertFrom-Json
if (-not $json.scripts) { $json | Add-Member -NotePropertyName scripts -NotePropertyValue @{} }
$json.scripts.dev   = "node server.mjs"
$json.scripts.start = "node server.mjs"
if (-not $json.type) { $json | Add-Member -NotePropertyName type -NotePropertyValue "module" }
elseif ($json.type -ne "module") { $json.type = "module" }
$json | ConvertTo-Json -Depth 100 | Set-Content -Path "package.json" -Encoding UTF8

# --- README.md ---
@"
# VPLM MCP (fresh)

WebSocket MCP server exposing VPLM repo.

## Env
- AUTH_TOKEN: Bearer token (empty = disabled)
- PORT: WebSocket port (default 7860; auto-picked if busy)
- REPO_ROOT: repo path to expose

## Run
cd mcp
node server.mjs

## Tools
- list_files(dir?, pattern?)
- read_file(path)
- search_text(query, exts?)
- md_index()
- repo_info()
- search(query) → {id,title,snippet}
- fetch(id)     → {uri,mimeType,text}
"@ | Set-Content -Path "README.md" -Encoding UTF8

# --- Return to repo root and wire root scripts ---
Set-Location ..
if (Test-Path "package.json") {
  $root = Get-Content -Raw -Path "package.json" | ConvertFrom-Json
  if (-not $root.scripts) { $root | Add-Member -NotePropertyName scripts -NotePropertyValue @{} }
  $root.scripts."mcp:dev"   = "cd mcp && node server.mjs"
  $root.scripts."mcp:start" = "cd mcp && node server.mjs"
  $root | ConvertTo-Json -Depth 100 | Set-Content -Path "package.json" -Encoding UTF8
} else {
  # create minimal root package.json if missing
  @"
{
  "name": "vplm-root",
  "private": true,
  "scripts": {
    "mcp:dev": "cd mcp && node server.mjs",
    "mcp:start": "cd mcp && node server.mjs"
  }
}
"@ | Set-Content -Path "package.json" -Encoding UTF8
}

Write-Host "`n✅ Fresh setup complete."
Write-Host "To run now: npm run mcp:dev"
Write-Host "Connector URL: ws://localhost:$freePort"
Write-Host "Auth header:   Authorization: Bearer $authToken"
# ===== end setup =====
```

---

## ✅ Next Steps

- Start the server: `npm run mcp:dev`  
- In ChatGPT → **Settings → Connectors → Add custom connector**  
  - **URL:** `ws://localhost:<PORT>` (printed above)  
  - **Header:** `Authorization: Bearer <AUTH_TOKEN>` (printed above)  

Use it in chat:
```
Use VPLM MCP → search query="readme"
Use VPLM MCP → fetch id="<id from previous step>"
```
