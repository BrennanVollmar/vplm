import express from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import fs from 'node:fs/promises'
import path from 'node:path'

function resolveSafe(p) {
  const abs = path.resolve(process.cwd(), p)
  const root = process.cwd()
  if (!abs.startsWith(root)) throw new Error('Path escapes repository root')
  return abs
}

function buildServer() {
  const server = new McpServer({ name: 'vplm-mcp', version: '0.1.0' })

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
    description: 'Search files for query text (naive recursive fallback)',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' }, dir: { type: 'string' } },
      required: ['query']
    }
  }, async ({ query, dir = '.' }) => {
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

  return server
}

const app = express()
app.use(express.json({ limit: '2mb' }))

// Health endpoint for Render
app.get('/', (_req, res) => res.status(200).send('ok'))
app.get('/health', (_req, res) => res.status(200).send('ok'))

// MCP endpoint (stateless per-request)
app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  res.on('close', () => { try { transport.close() } catch {} })
  try {
    const server = buildServer()
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: String(e?.message || 'Internal error') }, id: null })
  }
})

// Render provides PORT; default to 3333 locally. Bind to 0.0.0.0 for Render.
const port = Number(process.env.PORT || process.env.MCP_HTTP_PORT || 3333)
const host = process.env.MCP_HTTP_HOST || '0.0.0.0'
app.listen(port, host, () => {
  console.log(`MCP HTTP server listening on http://${host}:${port}`)
})
