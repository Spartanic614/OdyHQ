# Odyssey Mothership

Internal sales-leadership decision tool for Odyssey, backed by Supabase (Postgres + Auth + RLS) and a React/Vite frontend.

It answers four questions:

1. **Biggest SKU-authorization opportunities** — high-volume DCs that are *Not Authorized* on which SKUs.
2. **Anchor accounts to lock to unlock new DCs** — each dormant / eligible DC and its required KeHE anchor's review + contact status.
3. **Largest-TAM retailers not yet contacted** — a prioritized, editable category-review tracker.
4. **Unified, filterable calendar** of retailer promos, distributor promos, merchandising, and trade shows.

---

## Architecture

- **Frontend:** React 18 + Vite + TypeScript + Tailwind + Recharts + React Router.
- **Backend:** Supabase (Postgres + Auth + RLS).
- **Two Supabase access paths — do not conflate:**
  - **Runtime (browser):** `@supabase/supabase-js` with the **anon** key. All reads go through RLS; the only client write is the category-review inline edit.
  - **Seed (local Node script):** `scripts/seed.ts` uses the **service-role** key from `.env.local` (local only, gitignored) to load the Excel export.
  - The Supabase **MCP** was used only at dev time to create the schema/RLS/types. The running app never uses it.

Security: the anon key is public by design — protection comes from **RLS + Supabase Auth**, not from hiding the key. RLS is enabled on every table. `.env.local`, the service-role key, and `.mcp.json` are gitignored.

---

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in values
npm run dev
```

`.env.local`:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role secret>   # seed only — never shipped to the browser
```

The first two are already filled in for the current project. Add the service-role secret (Supabase → Project Settings → API → `service_role`) before seeding.

---

## Loading / refreshing data

The app reads from Postgres; data is loaded by a local script from the team's Excel export.

1. Export the workbook's **serving tabs** to `./data_import/Odyssey_Mothership_Export.xlsx`.
2. Run:

   ```bash
   npm run seed
   ```

The loader matches one serving tab → one table, normalizes headers to the DB column names, coerces numerics, and:
- **upserts** natural-key tables (`dim_sku`, `dim_dc`, `dim_chain`, `fact_dc_sku_auth`, `fact_chain_sku_auth`, `fact_category_review`) on their primary key, and
- **reloads** identity-key tables (`dim_prospect`, `dim_contact`, `bridge_dc_anchor`, `fact_calendar`, `ref_fees`) by clearing + inserting,

so a weekly refresh updates rather than duplicates. **No redeploy needed** — the app reflects new data on next load.

Expected row counts (Definition of Done): sku 19 · dc 51 · chain 320 · dc_sku_auth ~351 · chain_sku_auth ~437 · category_review 320 · bridge ~84 · calendar ~227 · prospect ~124 · fees ~25.

---

## Auth

Supabase Auth (email/password). No public sign-up — add team accounts in the Supabase dashboard (Authentication → Users). Unauthenticated users only see the login screen.

---

## Methodology

All weights/thresholds live in [`src/config/methodology.ts`](src/config/methodology.ts):

- **Priority score** = `total_universe × (0.5 + 0.5 × skuGapPct) × reviewUrgency`, normalized 0–100, tiered A/B/C.
- **Dormant DC** = `l52w_volume < DORMANT_VOLUME_THRESHOLD` (default 200).
- **Unlock candidate** = Dormant DC **or** `new_at_kehe = 'Eligible'`.

All colors live in [`src/theme.ts`](src/theme.ts) (mirrored in `tailwind.config.js`) — drop in the real Odyssey brand by editing those.

---

## Deploy (Vercel)

1. Push to GitHub, import to Vercel (**Vite** preset, output `dist`).
2. Set env vars in Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (**anon only** — never the service-role key).
3. SPA rewrite is handled by [`vercel.json`](vercel.json).
4. Add team users in Supabase. Share the URL.

---

## Project layout

```
scripts/seed.ts              # Excel → Supabase loader (service-role, local)
src/
  config/methodology.ts      # weights & thresholds
  theme.ts                   # palette (brand swap point)
  lib/
    supabaseClient.ts        # anon client (env-driven)
    database.types.ts        # generated types
    csv.ts, format.ts        # utilities
  auth/AuthProvider.tsx      # Supabase Auth gate
  data/
    store.tsx                # loads all tables; category-review write-back
    selectors.ts             # §4 calculations (pure)
    hooks.ts                 # memoized derived data
  components/                # DataTable, drawers, filters, states, KPI cards
  pages/                     # Overview, AccountManagement, Distribution, Calendar, Portfolio, ComingSoon
```

Phase-2 modules (Immediate Inventory, Trade Spend Calculator, PromoMash, DSD county map, Merch one-pagers) are nav stubs.
