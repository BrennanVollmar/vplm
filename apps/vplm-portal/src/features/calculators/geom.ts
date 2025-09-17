export const ACRE_SQFT = 43560

export function acresFromRect(lengthFt: number, widthFt: number): number {
  return (lengthFt * widthFt) / ACRE_SQFT
}

export function acresFromCircleRadius(radiusFt: number): number {
  return (Math.PI * radiusFt * radiusFt) / ACRE_SQFT
}

export function acresFromCircumference(circumferenceFt: number): number {
  // A = (C^2) / (4π)
  const areaSqft = (circumferenceFt * circumferenceFt) / (4 * Math.PI)
  return areaSqft / ACRE_SQFT
}

export function avgDepthFt(samplesFt: number[]): number {
  if (!samplesFt.length) return 0
  const sum = samplesFt.reduce((a, b) => a + b, 0)
  return sum / samplesFt.length
}

export function acreFeet(surfaceAcres: number, averageDepthFt: number): number {
  return surfaceAcres * averageDepthFt
}

export function acreFeetToGallons(acreFeet: number): number {
  return acreFeet * 325851.43
}

