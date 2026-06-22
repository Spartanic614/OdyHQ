import { DetailDrawer, Field, FieldGrid, Section } from './DetailDrawer'
import { AuthBadge, Pill } from './StatusBadge'
import { useData } from '../data/store'
import { dcStatus } from '../data/selectors'
import { fmtInt, fmtUsd, fmtNum } from '../lib/format'
import { tierColors } from '../theme'

// ---------------- Chain drawer ----------------
export function ChainDrawer({
  chainId,
  onClose,
}: {
  chainId: string | null
  onClose: () => void
}) {
  const { chains, chainSkuAuth, categoryReviews, anchors, dcs, skus } = useData()
  const chain = chains.rows.find((c) => c.chain_id === chainId)
  if (!chainId || !chain) return null

  const review = categoryReviews.rows.find((r) => r.chain_id === chainId)
  const skuRows = chainSkuAuth.rows.filter((r) => r.chain_id === chainId)
  const skuName = (code: string) =>
    skus.rows.find((s) => s.sku_code === code)?.flavor ?? code
  // DCs that this chain anchors.
  const anchoredDcCodes = new Set(
    anchors.rows.filter((a) => a.anchor_chain_id === chainId).map((a) => a.dc_code),
  )
  const linkedDcs = dcs.rows.filter((d) => anchoredDcCodes.has(d.dc_code))

  return (
    <DetailDrawer
      open
      title={chain.chain_name ?? chain.chain_id}
      subtitle={`${chain.channel ?? '—'} · ${chain.region ?? '—'}`}
      onClose={onClose}
    >
      <Section title="Account">
        <FieldGrid>
          <Field label="TAM (Total Universe)">{fmtInt(chain.total_universe)}</Field>
          <Field label="Account Manager">{chain.account_manager}</Field>
          <Field label="Channel">{chain.channel}</Field>
          <Field label="Region / State">
            {chain.region ?? '—'} / {chain.state ?? '—'}
          </Field>
          <Field label="Distributor">{chain.distributor}</Field>
          <Field label="Active">{chain.active}</Field>
          <Field label="Current SRP">{fmtUsd(chain.current_srp)}</Field>
          <Field label="Case Cost">{fmtUsd(chain.case_cost)}</Field>
          <Field label="EDLP">{chain.edlp}</Field>
          <Field label="INFRA / NCG">{chain.infra_ncg}</Field>
          <Field label="Green Spoon Mgr">{chain.green_spoon_manager}</Field>
          <Field label="Transitional to DSD">{chain.transitional_to_dsd}</Field>
        </FieldGrid>
      </Section>

      {review && (
        <Section title="Category Review">
          <FieldGrid>
            <Field label="Review Period 2026">{review.review_period_2026}</Field>
            <Field label="Meeting Progress">{review.meeting_progress}</Field>
            <Field label="Date Scheduled">{review.date_scheduled ?? '—'}</Field>
            <Field label="Odyssey in 2025">{review.odyssey_in_2025}</Field>
            <Field label="Odyssey in 2026">{review.odyssey_in_2026}</Field>
            <Field label="Comments">{review.comments}</Field>
          </FieldGrid>
        </Section>
      )}

      <Section title={`SKU Authorization (${skuRows.length})`}>
        {skuRows.length === 0 ? (
          <div className="text-sm text-muted">No SKU auth rows.</div>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            {skuRows.map((r) => (
              <div
                key={r.sku_code}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="truncate">{skuName(r.sku_code)}</span>
                <AuthBadge status={r.auth_status} />
              </div>
            ))}
          </div>
        )}
      </Section>

      {linkedDcs.length > 0 && (
        <Section title={`Anchors These DCs (${linkedDcs.length})`}>
          <div className="space-y-1">
            {linkedDcs.map((d) => (
              <div
                key={d.dc_code}
                className="flex items-center justify-between text-sm"
              >
                <span>{d.dc_name ?? d.dc_code}</span>
                <Pill color={tierColors[dcStatus(d) === 'Active' ? 'C' : 'A']}>
                  {dcStatus(d)} · vol {fmtNum(d.l52w_volume)}
                </Pill>
              </div>
            ))}
          </div>
        </Section>
      )}
    </DetailDrawer>
  )
}

// ---------------- DC drawer ----------------
export function DcDrawer({
  dcCode,
  onClose,
}: {
  dcCode: string | null
  onClose: () => void
}) {
  const { dcs, dcSkuAuth, skus, anchors, chains, fees } = useData()
  const dc = dcs.rows.find((d) => d.dc_code === dcCode)
  if (!dcCode || !dc) return null

  const skuRows = dcSkuAuth.rows.filter((r) => r.dc_code === dcCode)
  const skuName = (code: string) =>
    skus.rows.find((s) => s.sku_code === code)?.flavor ?? code
  const dcAnchors = anchors.rows.filter((a) => a.dc_code === dcCode)
  const chainName = (id: string | null) =>
    id ? (chains.rows.find((c) => c.chain_id === id)?.chain_name ?? id) : null
  // Fees applicable to this DC, matched by distributor type (fees↔DC via type).
  const applicableFees = fees.rows.filter(
    (f) =>
      f.distributor &&
      dc.type &&
      f.distributor.toLowerCase().includes(dc.type.toLowerCase().split(' ')[0]),
  )

  return (
    <DetailDrawer
      open
      title={dc.dc_name ?? dc.dc_code}
      subtitle={`${dc.type ?? '—'} · ${dc.city ?? ''} ${dc.state ?? ''}`}
      onClose={onClose}
    >
      <Section title="Distribution Center">
        <FieldGrid>
          <Field label="DC Code">{dc.dc_code}</Field>
          <Field label="Type">{dc.type}</Field>
          <Field label="Territory">{dc.territory}</Field>
          <Field label="Status">{dcStatus(dc)}</Field>
          <Field label="L52W Volume">{fmtInt(dc.l52w_volume)}</Field>
          <Field label="L52W Did-Buys">{fmtInt(dc.l52w_did_buys)}</Field>
          <Field label="New @ KeHE">{dc.new_at_kehe}</Field>
          <Field label="Odyssey Contact">{dc.odyssey_contact}</Field>
          <Field label="goCrisp Name">{dc.gocrisp_name}</Field>
          <Field label="Buyer">{dc.buyer}</Field>
          <Field label="DP Case Cost">{fmtUsd(dc.dp_case_cost)}</Field>
          <Field label="DP Margin">{dc.dp_margin == null ? '—' : `${dc.dp_margin}%`}</Field>
          <Field label="Location">
            {[dc.city, dc.state, dc.zip].filter(Boolean).join(', ') || '—'}
          </Field>
        </FieldGrid>
      </Section>

      <Section title={`SKU Authorization (${skuRows.length})`}>
        {skuRows.length === 0 ? (
          <div className="text-sm text-muted">No SKU auth rows.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {skuRows.map((r) => (
                <tr key={r.sku_code} className="border-t border-ink-700">
                  <td className="py-1">{skuName(r.sku_code)}</td>
                  <td className="py-1 text-right text-muted">
                    {r.moq != null ? `MOQ ${r.moq}` : ''}
                  </td>
                  <td className="py-1 text-right">
                    <AuthBadge status={r.auth_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {dcAnchors.length > 0 && (
        <Section title={`Key / Anchor Accounts (${dcAnchors.length})`}>
          <div className="space-y-1">
            {dcAnchors.map((a) => (
              <div key={a.id} className="text-sm">
                {a.anchor_chain_name ?? chainName(a.anchor_chain_id) ?? '—'}
              </div>
            ))}
          </div>
        </Section>
      )}

      {applicableFees.length > 0 && (
        <Section title="Applicable Fees">
          <div className="space-y-2">
            {applicableFees.map((f) => (
              <div key={f.id} className="text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{f.fee}</span>
                  <span className="text-muted">{f.cost}</span>
                </div>
                {f.definition && (
                  <div className="text-xs text-muted">{f.definition}</div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </DetailDrawer>
  )
}
