import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

const server = new McpServer({ name: 'vplm-mcp', version: '0.1.0' })

function resolveSafe(p) {
  const abs = path.resolve(process.cwd(), p)
  // Prevent escaping the repo root
  const root = process.cwd()
  if (!abs.startsWith(root)) throw new Error('Path escapes repository root')
  return abs
}

server.tool('list_dir', {
  description: 'List files and directories under a path',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' }
    },
    required: ['path']
  }
}, async ({ path: p }) => {
  const abs = resolveSafe(p)
  const entries = await fs.readdir(abs, { withFileTypes: true })
  return {
    content: [{
      type: 'json',
      json: entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }))
    }]
  }
})

server.tool('read_file', {
  description: 'Read a text file from the repo',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      maxBytes: { type: 'number' }
    },
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
    properties: {
      query: { type: 'string' },
      dir: { type: 'string' }
    },
    required: ['query']
  }
}, async ({ query, dir = '.' }) => {
  const cwd = resolveSafe(dir)
  // Try rg first
  const tryRg = await new Promise((resolve) => {
    const ps = spawn(process.platform === 'win32' ? 'rg.exe' : 'rg', ['-n', query, '-S'], { cwd })
    let out = ''
    let err = ''
    ps.stdout.on('data', (d) => { out += d.toString() })
    ps.stderr.on('data', (d) => { err += d.toString() })
    ps.on('error', () => resolve(null))
    ps.on('close', (code) => {
      if (code === 0 || (code === 1 && out === '')) resolve(out)
      else resolve(null)
    })
  })
  if (tryRg !== null) {
    return { content: [{ type: 'text', text: tryRg }] }
  }
  // Fallback: naive recursive search
  async function walk(dirPath, results) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dirPath, e.name)
      if (e.isDirectory()) await walk(full, results)
      else {
        try {
          const txt = await fs.readFile(full, 'utf8')
          const lines = txt.split(/\r?\n/)
          lines.forEach((line, i) => {
            if (line.includes(query)) results.push(`${full}:${i + 1}:${line}`)
          })
        } catch {}
      }
    }
  }
  const results = []
  await walk(cwd, results)
  return { content: [{ type: 'text', text: results.join('\n') }] }
})

const transport = new StdioServerTransport()
await server.connect(transport)
// Keep the process alive
process.stdin.resume()

