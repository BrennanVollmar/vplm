import { describe, it, expect } from 'vitest'
import { calcDose } from './dosing'

describe('dosing', () => {
  it('acre-foot basis', () => {
    const rule = { target: 'algae', basis: 'acre-foot', minRate: 2.72, maxRate: 5.44, unit: 'lbs/ac-ft' } as const
    const res = calcDose(rule, { surfaceAcres: 0.344, avgDepthFt: 4 })
    expect(res.amount).toBeCloseTo(2.72 * (0.344 * 4), 3)
  })
  it('surface-acre basis', () => {
    const rule = { target: 'algae', basis: 'surface-acre', minRate: 1, maxRate: 2, unit: 'gal/ac' } as const
    const res = calcDose(rule, { surfaceAcres: 2 })
    expect(res.amount).toBe(2)
  })
})

