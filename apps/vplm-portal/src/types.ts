export type Role = 'tech' | 'lead' | 'admin'

export interface UserProfile {
  id: string
  email: string
  role: Role
  displayName?: string
}

export interface Job {
  id: string
  localId?: string
  clientName: string
  siteName?: string
  address?: string
  lat?: number
  lon?: number
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export interface FieldNote {
  id: string
  jobId: string
  text: string
  tags?: string[]
  createdAt: string
}

export interface Photo {
  id: string
  jobId: string
  localUri?: string
  blob?: Blob
  serverUri?: string
  caption?: string
  createdAt: string
  exif?: Record<string, any>
}

export interface Measurement {
  id: string
  jobId: string
  kind: 'length' | 'width' | 'depth' | 'perimeter' | 'depthSample' | 'custom'
  unit: 'ft' | 'in' | 'yd' | 'm' | 'cm'
  value: number
  createdAt: string
}

export interface CalcResult {
  id: string
  jobId?: string
  type: string
  inputs: any
  outputs: any
  createdAt: string
}

export interface DoseRule {
  target: 'algae' | 'weeds' | 'bacteria' | 'other'
  basis: 'surface-acre' | 'acre-foot' | 'ppm' | 'gal-per-1000gal'
  minRate: number
  maxRate: number
  unit: string
  notes?: string
  legalMaxPerApp?: string
  legalMaxAnnual?: string
}

export interface ChemProduct {
  id: string
  brand: string
  active: string
  form: 'liquid' | 'granular' | 'crystal' | 'other'
  strength?: string
  labelNotes?: string
  doseRules: DoseRule[]
}

export interface ChemLabel {
  id: string
  productId: string
  filename: string
  mimeType: string
  size: number
  blob: Blob
  createdAt: string
}
