export interface AddressSuggestion {
  id: string
  label: string
  addressLine: string
  city?: string
  region?: string
  postalCode?: string
  country?: string
  lat?: number
  lon?: number
  source: 'mapbox' | 'osm'
}

const MAPBOX_TOKEN_KEY = 'mapbox_access_token'

export function getMapboxToken(): string | null {
  try {
    return localStorage.getItem(MAPBOX_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setMapboxToken(token: string) {
  try {
    if (token) localStorage.setItem(MAPBOX_TOKEN_KEY, token)
    else localStorage.removeItem(MAPBOX_TOKEN_KEY)
  } catch {
    /* ignore persistence issues */
  }
}

const NOMINATIM_HEADERS: RequestInit = {
  headers: {
    'Accept': 'application/json',
    'User-Agent': 'VPLM Portal (autocomplete)'
  }
}

export async function fetchAddressSuggestions(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim()
  if (!q) return []
  const token = getMapboxToken()
  if (token) {
    try {
      const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`)
      url.searchParams.set('autocomplete', 'true')
      url.searchParams.set('limit', '6')
      url.searchParams.set('types', 'address,place,poi')
      url.searchParams.set('access_token', token)
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`Mapbox error: ${res.status}`)
      const data = await res.json()
      if (data && Array.isArray(data.features)) {
        return data.features.map((feature: any) => {
          const context = feature.context || []
          const lookup = (type: string) => {
            const item = context.find((c: any) => typeof c.id === 'string' && c.id.startsWith(type))
            return item?.text || item?.short_code || undefined
          }
          const props = feature.properties || {}
          return {
            id: String(feature.id || feature.place_name),
            label: feature.place_name || feature.text,
            addressLine: feature.text || feature.place_name,
            city: props.place || lookup('place'),
            region: props.region || lookup('region'),
            postalCode: props.postcode || lookup('postcode'),
            country: props.country || lookup('country'),
            lat: typeof feature.center?.[1] === 'number' ? feature.center[1] : feature.geometry?.coordinates?.[1],
            lon: typeof feature.center?.[0] === 'number' ? feature.center[0] : feature.geometry?.coordinates?.[0],
            source: 'mapbox',
          } as AddressSuggestion
        })
      }
    } catch (err) {
      console.warn('Mapbox autocomplete fallback', err)
    }
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('limit', '6')
    url.searchParams.set('q', q)
    const res = await fetch(url.toString(), NOMINATIM_HEADERS)
    if (!res.ok) throw new Error(`Nominatim error: ${res.status}`)
    const data = await res.json()
    if (Array.isArray(data)) {
      return data.map((entry: any) => {
        const addr = entry.address || {}
        return {
          id: String(entry.place_id || entry.osm_id || entry.display_name),
          label: entry.display_name,
          addressLine: entry.display_name,
          city: addr.city || addr.town || addr.village,
          region: addr.state,
          postalCode: addr.postcode,
          country: addr.country,
          lat: entry.lat ? Number(entry.lat) : undefined,
          lon: entry.lon ? Number(entry.lon) : undefined,
          source: 'osm',
        } as AddressSuggestion
      })
    }
  } catch (err) {
    console.warn('OSM autocomplete failed', err)
  }
  return []
}
