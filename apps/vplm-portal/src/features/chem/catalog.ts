import { db } from '../offline/db'
import type { ChemProduct } from '../../types'

export async function ensureCatalogSeeded(): Promise<void> {
  const count = await db.chemProducts.count()
  if (count > 0) return
  try {
    const res = await fetch('/data/chemicals.json')
    const data = (await res.json()) as ChemProduct[]
    if (data?.length) await db.chemProducts.bulkPut(data)
  } catch {}
}

export async function getAllProducts(): Promise<ChemProduct[]> {
  await ensureCatalogSeeded()
  return db.chemProducts.toArray()
}

export async function searchProducts(q: string): Promise<ChemProduct[]> {
  const items = await getAllProducts()
  if (!q) return items
  const s = q.toLowerCase()
  return items.filter((p) => [p.id, p.brand, p.active].some((f) => f.toLowerCase().includes(s)))
}

