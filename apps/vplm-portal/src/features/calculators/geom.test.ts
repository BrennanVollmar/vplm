import { describe, it, expect } from 'vitest'
import { acresFromRect, acresFromCircleRadius, acresFromCircumference, avgDepthFt, acreFeet, acreFeetToGallons } from './geom'

describe('geom calculators', () => {
  it('rect area to acres', () => {
    expect(acresFromRect(150, 100)).toBeCloseTo(0.344, 3)
  })
  it('circle area to acres', () => {
    const r = 50
    expect(acresFromCircleRadius(r)).toBeCloseTo((Math.PI * r * r) / 43560, 6)
  })
  it('circumference to acres', () => {
    const c = 100 * Math.PI * 2 // perimeter for radius 100
    const acres = acresFromCircumference(c)
    expect(acres).toBeCloseTo((Math.PI * 100 * 100) / 43560, 6)
  })
  it('average depth', () => {
    expect(avgDepthFt([3, 4, 5, 4])).toBeCloseTo(4.0, 6)
  })
  it('acre-feet and gallons', () => {
    const acres = acresFromRect(150, 100)
    const vol = acreFeet(acres, 4)
    const expected = ((150 * 100) / 43560) * 4
    expect(vol).toBeCloseTo(expected, 6)
    expect(acreFeetToGallons(vol)).toBeGreaterThan(400000)
  })
})
