import type { ChemProduct, DoseRule } from '../../types'

export function parseCsvToProducts(csv: string): ChemProduct[] {
  const lines = csv.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const header = lines[0].split(',').map((h) => h.trim())
  const rows = lines.slice(1)
  const products: Record<string, ChemProduct> = {}
  for (const row of rows) {
    if (!row.trim()) continue
    const cols = splitCsvRow(row)
    const rec: any = {}
    header.forEach((h, i) => { rec[h] = cols[i] })
    const id = rec.id || slug(`${rec.brand || ''} ${rec.active || ''}`)
    const doseRule: DoseRule | null = rec.rule_target && rec.rule_basis ? {
      target: rec.rule_target,
      basis: rec.rule_basis,
      minRate: num(rec.rule_min),
      maxRate: num(rec.rule_max),
      unit: rec.rule_unit || '',
      notes: undefined,
      legalMaxPerApp: rec.legal_max_app || undefined,
      legalMaxAnnual: rec.legal_max_annual || undefined,
    } : null
    if (!products[id]) {
      products[id] = {
        id,
        brand: rec.brand || 'Unknown',
        active: rec.active || 'Unknown',
        form: (rec.form || 'other') as any,
        strength: rec.strength || undefined,
        labelNotes: rec.label_notes || undefined,
        doseRules: doseRule ? [doseRule] : [],
      }
    } else if (doseRule) {
      products[id].doseRules.push(doseRule)
    }
  }
  return Object.values(products)
}

function num(x: any): number { const n = Number(x); return Number.isFinite(n) ? n : 0 }
function slug(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') }

function splitCsvRow(row: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (inQ) {
      if (ch === '"' && row[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') { inQ = false }
      else { cur += ch }
    } else {
      if (ch === '"') inQ = true
      else if (ch === ',') { out.push(cur); cur = '' }
      else { cur += ch }
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

