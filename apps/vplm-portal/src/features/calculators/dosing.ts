import type { DoseRule } from '../../types'
import { acreFeetToGallons } from './geom'

export function calcDose(
  rule: DoseRule,
  inputs: { surfaceAcres?: number; volAcreFt?: number; avgDepthFt?: number; gallons?: number }
): { amount: number; unit: string; warnings: string[] } {
  const warnings: string[] = []
  let amount = 0
  const unit = rule.unit

  if (rule.basis === 'surface-acre') {
    const acres = inputs.surfaceAcres ?? 0
    const rate = rule.minRate // choose min as default; UI can expose range
    amount = rate * acres
  } else if (rule.basis === 'acre-foot') {
    const volAf = inputs.volAcreFt ?? (
      (inputs.surfaceAcres ?? 0) * (inputs.avgDepthFt ?? 0)
    )
    const rate = rule.minRate
    amount = rate * volAf
  } else if (rule.basis === 'ppm') {
    // Simplified: ppm * gallons * 0.001 (kg/ppm per 1000 gal) — product specific density not handled
    const gallons = inputs.gallons ?? (
      inputs.volAcreFt ? acreFeetToGallons(inputs.volAcreFt) : 0
    )
    const ppm = rule.minRate
    amount = ppm * gallons * 0.001
    warnings.push('PPM dosing simplified; confirm product density/label requirements')
  } else if (rule.basis === 'gal-per-1000gal') {
    const gallons = inputs.gallons ?? (
      inputs.volAcreFt ? acreFeetToGallons(inputs.volAcreFt) : 0
    )
    const rate = rule.minRate
    amount = (gallons / 1000) * rate
  }

  if (rule.legalMaxPerApp) warnings.push(`Max per application: ${rule.legalMaxPerApp}`)
  if (rule.legalMaxAnnual) warnings.push(`Max per year: ${rule.legalMaxAnnual}`)

  return { amount, unit, warnings }
}

