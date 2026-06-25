import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Self-contained SVG pin — avoids depending on Leaflet's PNG marker assets,
// which can 404 behind a bundler/CSP and leave the marker invisible.
const PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">
  <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 13.4 25.6 14 26.2a1.4 1.4 0 0 0 2 0C16.6 40.6 30 25.5 30 15 30 6.7 23.3 0 15 0z" fill="#b00830"/>
  <circle cx="15" cy="15" r="6" fill="#fff"/>
</svg>`

const PIN_ICON = L.divIcon({
  className: 'map-pin-icon',
  html: PIN_SVG,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
})

// Roughly the South Africa extent, used as the default view + pan bounds.
const SA_CENTER: L.LatLngTuple = [-29.0, 24.7]
const SA_BOUNDS: L.LatLngBoundsExpression = [
  [-35.5, 15.5],
  [-21.5, 33.5],
]

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

export function MapPicker({
  lat,
  lng,
  onChange,
  searchQuery,
}: {
  lat: number | null
  lng: number | null
  onChange: (lat: number | null, lng: number | null) => void
  searchQuery?: string
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  const [query, setQuery] = useState(searchQuery ?? '')
  const [searching, setSearching] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    lat != null && lng != null ? { lat, lng } : null,
  )

  const placeMarker = (la: number, ln: number) => {
    const map = mapRef.current
    if (!map) return
    const pos: L.LatLngTuple = [la, ln]
    if (markerRef.current) {
      markerRef.current.setLatLng(pos)
    } else {
      const m = L.marker(pos, { draggable: true, icon: PIN_ICON }).addTo(map)
      m.on('dragend', () => {
        const ll = m.getLatLng()
        const rla = round6(ll.lat)
        const rln = round6(ll.lng)
        setCoords({ lat: rla, lng: rln })
        onChangeRef.current(rla, rln)
      })
      markerRef.current = m
    }
  }

  // Initialise the map once.
  useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const hasPin = lat != null && lng != null
    const map = L.map(elRef.current, {
      center: hasPin ? [lat as number, lng as number] : SA_CENTER,
      zoom: hasPin ? 14 : 5,
      maxBounds: SA_BOUNDS,
      maxBoundsViscosity: 0.7,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)
    mapRef.current = map

    if (hasPin) placeMarker(lat as number, lng as number)

    map.on('click', (e: L.LeafletMouseEvent) => {
      const rla = round6(e.latlng.lat)
      const rln = round6(e.latlng.lng)
      placeMarker(rla, rln)
      setCoords({ lat: rla, lng: rln })
      onChangeRef.current(rla, rln)
    })

    // Modal animates in — make sure Leaflet measures the container correctly.
    setTimeout(() => map.invalidateSize(), 200)

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const search = async () => {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setNote(null)
    try {
      const url =
        'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=za&q=' +
        encodeURIComponent(q)
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
      const list = (await res.json()) as { lat: string; lon: string }[]
      if (!list.length) {
        setNote('No match found in South Africa.')
        return
      }
      const la = round6(parseFloat(list[0].lat))
      const ln = round6(parseFloat(list[0].lon))
      mapRef.current?.setView([la, ln], 16)
      placeMarker(la, ln)
      setCoords({ lat: la, lng: ln })
      onChangeRef.current(la, ln)
    } catch {
      setNote('Search failed — drop a pin manually instead.')
    } finally {
      setSearching(false)
    }
  }

  const clear = () => {
    if (markerRef.current && mapRef.current) {
      mapRef.current.removeLayer(markerRef.current)
      markerRef.current = null
    }
    setCoords(null)
    onChangeRef.current(null, null)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void search()
    }
  }

  return (
    <div className="map-picker">
      <div className="map-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search an address or place…"
        />
        <button type="button" className="btn-ghost sm" onClick={() => void search()} disabled={searching}>
          {searching ? 'Searching…' : 'Find'}
        </button>
      </div>
      <div ref={elRef} className="map-canvas" />
      <div className="map-foot">
        <span className="map-coords">
          {coords ? `📍 ${coords.lat}, ${coords.lng}` : 'Click the map or search to drop a pin'}
        </span>
        {coords && (
          <button type="button" className="btn-ghost sm" onClick={clear}>Clear pin</button>
        )}
      </div>
      {note && <div className="map-note">{note}</div>}
    </div>
  )
}
