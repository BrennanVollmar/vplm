import { describe, it, expect } from 'vitest'
import { feetToMeters, metersToFeet, inchesToFeet, feetToInches, yardsToFeet, feetToYards, acreFeetToGallonsUS, gallonsUSToAcreFeet } from './conversion'

describe('conversions', () => {
  it('feet/meters', () => {
    expect(feetToMeters(1)).toBeCloseTo(0.3048, 6)
    expect(metersToFeet(1)).toBeCloseTo(3.28084, 5)
  })
  it('inches/feet', () => {
    expect(inchesToFeet(12)).toBe(1)
    expect(feetToInches(2)).toBe(24)
  })
  it('yards/feet', () => {
    expect(yardsToFeet(2)).toBe(6)
    expect(feetToYards(9)).toBe(3)
  })
  it('acre-feet/gallons', () => {
    expect(acreFeetToGallonsUS(1)).toBeCloseTo(325851.43, 2)
    expect(gallonsUSToAcreFeet(325851.43)).toBeCloseTo(1, 5)
  })
})

