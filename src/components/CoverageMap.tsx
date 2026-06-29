import { useEffect, useMemo, useRef, useState } from 'react'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'
import { theme } from '../theme'
import type { Status } from '../lib/coverageCompare'

const STATUS_COLOR: Record<Status, string> = {
  served: theme.good,
  gap: theme.bad,
  coverageOnly: '#39414f',
}
const NO_DATA = '#161a20'
const W = 975
const H = 610

interface Props {
  statusByFips: Map<string, Status>
  exportName?: string
}

// US county choropleth (FIPS-keyed) with PNG export. Map data is fetched from
// /us-counties-10m.json (public/) so it stays out of the JS bundle.
export function CoverageMap({ statusByFips, exportName = 'coverage_map' }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [topo, setTopo] = useState<unknown>(null)
  const [err, setErr] = useState<string | null>(null)

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
    const counties = (
      feature(t, t.objects.counties) as unknown as FeatureCollection<Geometry, GeoJsonProperties>
    ).features
    const projection = geoAlbersUsa().fitSize([W, H], nation)
    const path = geoPath(projection)
    return {
      counties: counties.map((f) => ({
        id: String((f as Feature & { id?: string | number }).id ?? ''),
        d: path(f) || '',
      })),
      borders: path(mesh(t, t.objects.states, (a: unknown, b: unknown) => a !== b)) || '',
    }
  }, [topo])

  const fillFor = (fips: string) => {
    const s = statusByFips.get(fips)
    return s ? STATUS_COLOR[s] : NO_DATA
  }

  const exportPng = () => {
    const svg = svgRef.current
    if (!svg) return
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(W))
    clone.setAttribute('height', String(H))
    const xml = new XMLSerializer().serializeToString(clone)
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
    const img = new Image()
    img.onload = () => {
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = W * scale
      canvas.height = H * scale
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = theme.bg
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

  if (err)
    return <div className="text-xs text-bad p-4">Couldn’t load map data ({err}).</div>
  if (!geo) return <div className="text-sm text-muted p-6 text-center">Loading map…</div>

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Legend />
        <button className="btn text-xs" onClick={exportPng}>
          ⤓ Export PNG
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto rounded border border-white/10"
        style={{ background: theme.bg }}
      >
        <rect x={0} y={0} width={W} height={H} fill={theme.bg} />
        {geo.counties.map((c) =>
          c.d ? <path key={c.id} d={c.d} fill={fillFor(c.id)} /> : null,
        )}
        <path d={geo.borders} fill="none" stroke="#000" strokeOpacity={0.35} strokeWidth={0.5} />
      </svg>
    </div>
  )
}

function Legend() {
  const items: [string, string][] = [
    ['Served (outlets + coverage)', theme.good],
    ['Gap (outlets, no coverage)', theme.bad],
    ['Coverage only', '#39414f'],
  ]
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
      {items.map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
          {label}
        </span>
      ))}
    </div>
  )
}
