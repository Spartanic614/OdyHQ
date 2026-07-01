import { useEffect, useMemo, useRef, useState } from 'react'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'

const W = 975
const H = 610
const NO_DATA_DEFAULT = '#161a20'

// 2-digit state FIPS → abbreviation, for hover labels ("Mohave, AZ").
const FIPS2_ABBR: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT',
  '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL',
  '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD',
  '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE',
  '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV',
  '55': 'WI', '56': 'WY',
}

export interface MapLegendItem {
  label: string
  color: string
}

interface Props {
  /** county FIPS (5-digit) → fill color */
  fillByFips: Map<string, string>
  defaultFill?: string
  /** county FIPS → extra hover detail line (e.g. distributor / status) */
  tooltipByFips?: Map<string, string>
  legend?: MapLegendItem[]
  exportName?: string
}

// Interactive US county choropleth. Colors are supplied per-FIPS by the parent
// (so they're fully customizable); hover shows the county + a detail line.
// Map geometry is fetched from public/us-counties-10m.json (out of the bundle).
export function CoverageMap({
  fillByFips,
  defaultFill = NO_DATA_DEFAULT,
  tooltipByFips,
  legend,
  exportName = 'county_map',
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [topo, setTopo] = useState<unknown>(null)
  const [err, setErr] = useState<string | null>(null)
  const [hover, setHover] = useState<{ fips: string; x: number; y: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/us-counties-10m.json')
      .then((r) => {
        if (!r.ok) throw new Error(`map data ${r.status}`)
        return r.json()
      })
      .then((d) => !cancelled && setTopo(d))
      .catch((e) => !cancelled && setErr(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
    }
  }, [])

  const geo = useMemo(() => {
    if (!topo) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = topo as any
    const nation = feature(t, t.objects.nation) as unknown as Feature<Geometry>
    const fc = feature(t, t.objects.counties) as unknown as FeatureCollection<
      Geometry,
      GeoJsonProperties
    >
    const projection = geoAlbersUsa().fitSize([W, H], nation)
    const path = geoPath(projection)
    const nameByFips = new Map<string, string>()
    const counties = fc.features.map((f) => {
      const id = String((f as Feature & { id?: string | number }).id ?? '')
      const name = (f.properties?.name as string) ?? ''
      if (name) nameByFips.set(id, name)
      return { id, d: path(f) || '' }
    })
    return {
      counties,
      nameByFips,
      borders: path(mesh(t, t.objects.states, (a: unknown, b: unknown) => a !== b)) || '',
    }
  }, [topo])

  // Memoized so hover (position) changes don't rebuild ~3.1k paths.
  const paths = useMemo(() => {
    if (!geo) return null
    return geo.counties.map((c) =>
      c.d ? (
        <path key={c.id} data-fips={c.id} d={c.d} fill={fillByFips.get(c.id) ?? defaultFill} />
      ) : null,
    )
  }, [geo, fillByFips, defaultFill])

  const onMove = (e: React.MouseEvent) => {
    const el = e.target as Element
    const fips = el.getAttribute?.('data-fips')
    const rect = wrapRef.current?.getBoundingClientRect()
    if (fips && rect) setHover({ fips, x: e.clientX - rect.left, y: e.clientY - rect.top })
    else setHover(null)
  }

  const exportPng = () => {
    const svg = svgRef.current
    if (!svg) return
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(W))
    clone.setAttribute('height', String(H))
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(clone)], {
        type: 'image/svg+xml;charset=utf-8',
      }),
    )
    const img = new Image()
    img.onload = () => {
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = W * scale
      canvas.height = H * scale
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#0a0c0f'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((b) => {
          if (!b) return
          const a = document.createElement('a')
          a.href = URL.createObjectURL(b)
          a.download = `${exportName}.png`
          a.click()
          URL.revokeObjectURL(a.href)
        }, 'image/png')
      }
      URL.revokeObjectURL(url)
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }

  if (err) return <div className="text-xs text-bad p-4">Couldn’t load map data ({err}).</div>
  if (!geo) return <div className="text-sm text-muted p-6 text-center">Loading map…</div>

  const tipName = hover ? geo.nameByFips.get(hover.fips) : null
  const tipDetail = hover && tooltipByFips ? tooltipByFips.get(hover.fips) : null
  const tipAbbr = hover ? FIPS2_ABBR[hover.fips.slice(0, 2)] : null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        {legend ? <Legend items={legend} /> : <span />}
        <button className="btn text-xs" onClick={exportPng}>
          ⤓ Export PNG
        </button>
      </div>
      <div ref={wrapRef} className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto rounded border border-white/10"
          style={{ background: '#0a0c0f' }}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <rect x={0} y={0} width={W} height={H} fill="#0a0c0f" />
          {paths}
          <path d={geo.borders} fill="none" stroke="#000" strokeOpacity={0.35} strokeWidth={0.5} />
        </svg>
        {hover && (tipName || tipDetail) && (
          <div
            className="absolute pointer-events-none z-10 text-xs rounded px-2 py-1 shadow-lg"
            style={{
              left: Math.min(hover.x + 12, (wrapRef.current?.clientWidth ?? W) - 160),
              top: hover.y + 12,
              background: '#0a0c0f',
              border: '1px solid #2a2f38',
            }}
          >
            {tipName && (
              <div className="font-semibold">
                {tipName}
                {tipAbbr ? `, ${tipAbbr}` : ''}
              </div>
            )}
            {tipDetail && <div className="text-muted">{tipDetail}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

function Legend({ items }: { items: MapLegendItem[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}
