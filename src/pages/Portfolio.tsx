import { useState } from 'react'
import { useData, type Sku } from '../data/store'
import { DataTable, type Column } from '../components/DataTable'
import { SelectFilter, uniqueValues } from '../components/Filters'
import { TableSkeleton, ErrorBanner } from '../components/States'
import { fmtUsd } from '../lib/format'

export function Portfolio() {
  const { skus, loading } = useData()
  const [mg, setMg] = useState('')
  const [pack, setPack] = useState('')

  const filtered = skus.rows
    .filter((s) => !mg || s.mg === mg)
    .filter((s) => !pack || s.pack === pack)

  const columns: Column<Sku>[] = [
    { key: 'sku_code', label: 'SKU', value: (s) => s.sku_code, render: (s) => <span className="font-mono text-xs">{s.sku_code}</span> },
    { key: 'flavor', label: 'Flavor', value: (s) => s.flavor, render: (s) => <span className="font-medium">{s.flavor}</span> },
    { key: 'mg', label: 'mg', value: (s) => s.mg },
    { key: 'pack', label: 'Pack', value: (s) => s.pack },
    { key: 'retail_upc', label: 'Retail UPC', value: (s) => s.retail_upc, render: (s) => <span className="font-mono text-xs">{s.retail_upc}</span> },
    { key: 'srp', label: 'SRP', align: 'right', value: (s) => s.srp, render: (s) => fmtUsd(s.srp) },
    { key: 'dist_case_cost', label: 'Dist Case Cost', align: 'right', value: (s) => s.dist_case_cost, render: (s) => fmtUsd(s.dist_case_cost) },
  ]

  if (loading) return <TableSkeleton />
  if (skus.error) return <ErrorBanner table="dim_sku" message={skus.error} />

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Portfolio / SKU Specs</h1>
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(s) => s.sku_code}
        exportName="portfolio_skus"
        initialSort={{ key: 'sku_code', dir: 'asc' }}
        searchPlaceholder="Search SKUs…"
        toolbar={
          <div className="flex items-center gap-2">
            <SelectFilter label="mg" value={mg} onChange={setMg} options={uniqueValues(skus.rows, (s) => s.mg)} />
            <SelectFilter label="Pack" value={pack} onChange={setPack} options={uniqueValues(skus.rows, (s) => s.pack)} />
          </div>
        }
      />
    </div>
  )
}
