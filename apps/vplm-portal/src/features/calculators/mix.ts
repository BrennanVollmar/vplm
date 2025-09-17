export interface TankMixInput {
  tankVolumeGal: number // total finished spray volume
  targetConcentrationPct: number // desired concentration of active in finished solution (% v/v or w/v)
  productStrengthPct: number // product strength (% active)
}

export interface TankMixResult {
  productNeededGal: number
  carrierNeededGal: number
}

// Simplified volume-based mixing: productNeeded = tankVolume * (target% / productStrength%)
export function calcTankMix(i: TankMixInput): TankMixResult {
  const fraction = i.targetConcentrationPct / i.productStrengthPct
  const productNeededGal = i.tankVolumeGal * fraction
  const carrierNeededGal = Math.max(0, i.tankVolumeGal - productNeededGal)
  return { productNeededGal, carrierNeededGal }
}

