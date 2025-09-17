import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import fs from 'node:fs/promises'
import path from 'node:path'

const server = new McpServer({ name: 'vplm-mcp', version: '0.1.0' })

function resolveSafe(p) {
  const abs = path.resolve(process.cwd(), p)
  const root = process.cwd()
  if (!abs.startsWith(root)) throw new Error('Path escapes repository root')
  return abs
}

server.tool('list_dir', {
  description: 'List files and directories under a path',
  inputSchema: {
    type: 'object',
    properties: { path: { type: 'string' } },
    required: ['path']
  }
}, async ({ path: p }) => {
  const abs = resolveSafe(p)
  const entries = await fs.readdir(abs, { withFileTypes: true })
  return { content: [{ type: 'json', json: entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' })) }] }
})

server.tool('read_file', {
  description: 'Read a text file from the repo',
  inputSchema: {
    type: 'object',
    properties: { path: { type: 'string' }, maxBytes: { type: 'number' } },
    required: ['path']
  }
}, async ({ path: p, maxBytes }) => {
  const abs = resolveSafe(p)
  const data = await fs.readFile(abs)
  const buf = maxBytes ? data.slice(0, maxBytes) : data
  return { content: [{ type: 'text', text: buf.toString('utf8') }] }
})

server.tool('search_text', {
  description: 'Search files for query text using ripgrep if available',
  inputSchema: {
    type: 'object',
    properties: { query: { type: 'string' }, dir: { type: 'string' } },
    required: ['query']
  }
}, async ({ query, dir = '.' }) => {
  // Minimal fallback: walk + contains; to keep http example dependency-free
  const results = []
  const start = resolveSafe(dir)
  async function walk(d) {
    const entries = await fs.readdir(d, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(d, e.name)
      if (e.isDirectory()) await walk(full)
      else {
        try {
          const txt = await fs.readFile(full, 'utf8')
          const lines = txt.split(/\r?\n/)
          lines.forEach((line, i) => { if (line.includes(query)) results.push(`${full}:${i + 1}:${line}`) })
        } catch {}
      }
    }
  }
  await walk(start)
  return { content: [{ type: 'text', text: results.join('\n') }] }
})

// Render provides PORT; default to 3333 locally. Bind to 0.0.0.0 for Render.
const port = Number(process.env.PORT || process.env.MCP_HTTP_PORT || 3333)
const host = process.env.MCP_HTTP_HOST || '0.0.0.0'
const transport = new StreamableHTTPServerTransport({ port, host })
await server.connect(transport)
console.log(`MCP HTTP server listening on http://${host}:${port}`)
