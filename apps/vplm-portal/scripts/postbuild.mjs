import { promises as fs } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')
const indexPath = join(distDir, 'index.html')
const fallbackPath = join(distDir, '404.html')
const cnamePath = join(distDir, 'CNAME')
const domain = 'www.lakemanagementservice.com'

async function ensureExists(path) {
  try {
    await fs.access(path)
  } catch {
    throw new Error(`Required file missing: ${path}`)
  }
}

async function main() {
  await ensureExists(indexPath)

  const html = await fs.readFile(indexPath)
  // Ship the same built shell for GitHub Pages 404s so deep links load the SPA.
  await fs.writeFile(fallbackPath, html)

  await fs.writeFile(cnamePath, `${domain}\n`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
