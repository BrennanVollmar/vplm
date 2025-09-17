#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = { url: 'http://localhost:5173', qa: false, keep: true }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--url' && args[i+1]) { opts.url = args[++i]; continue }
    if (a === '--qa') { opts.qa = true; continue }
    if (a === '--no-qa') { opts.qa = false; continue }
    if (a === '--keep') { opts.keep = true; continue }
    if (a === '--no-keep') { opts.keep = false; continue }
  }
  return opts
}

async function waitFor(url, { timeoutMs = 90000, intervalMs = 1000 } = {}) {
  const start = Date.now()
  let lastErr
  while (Date.now() - start < timeoutMs) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 4000)
      const r = await fetch(url, { signal: ctrl.signal })
      clearTimeout(t)
      if (r.ok) return true
      lastErr = new Error(`HTTP ${r.status}`)
    } catch (e) {
      lastErr = e
    }
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw lastErr || new Error('Timeout waiting for ' + url)
}

async function run() {
  const opts = parseArgs()
  const isWin = process.platform === 'win32'
  const npmCmd = isWin ? 'npm.cmd' : 'npm'

  const outDir = resolve(__dirname, 'out')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
  const outLog = createWriteStream(join(outDir, 'vite-dev.out.log'))
  const errLog = createWriteStream(join(outDir, 'vite-dev.err.log'))

  console.log('Starting dev server...')
  const child = spawn(npmCmd, ['--prefix','apps/vplm-portal','run','dev','--','--host'], {
    cwd: resolve(__dirname, '../..'),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.pipe(outLog)
  child.stderr.pipe(errLog)
  let exited = false
  child.on('exit', (code, sig) => { exited = true; console.log(`Dev server exited (code=${code}, sig=${sig})`) })

  try {
    await waitFor(opts.url)
    console.log('Dev server is up at', opts.url)
  } catch (e) {
    console.error('Failed to reach app at', opts.url, '-', e?.message || e)
    if (!opts.keep) child.kill()
    process.exit(1)
  }

  let qaStatus = 0
  if (opts.qa) {
    console.log('Running web-qa-agent against', opts.url)
    qaStatus = await new Promise((resolveExit) => {
      const qa = spawn(npmCmd, ['run','qa'], {
        cwd: resolve(__dirname, '../web-qa-agent'),
        env: { ...process.env, BASE_URL: opts.url },
        stdio: 'inherit',
      })
      qa.on('exit', (code) => resolveExit(code || 0))
    })
  }

  if (!opts.keep && !exited) {
    console.log('Stopping dev server...')
    child.kill()
  }

  if (qaStatus !== 0) {
    console.error('QA failed with status', qaStatus)
    process.exit(qaStatus)
  }
  console.log('Done.')
}

run().catch((e) => { console.error(e); process.exit(1) })

