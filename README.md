# Profil Kesehatan — AKI / AKB database pilot

Database design for a dashboard over `profilkes_2025.xlsx` (Profil Kesehatan
Kabupaten Situbondo, 2025). Scope for this pass: **Angka Kematian Ibu (AKI)** and
**Angka Kematian Bayi (AKB)**, dashboard-read-only, verified against the workbook.

```
db/00_reset.sql                 drops every object (dev only)
db/01_schema.sql                dims, facts, import provenance
db/02_views.sql                 AKI/AKB marts + Wilson confidence intervals
scripts/load_profilkes.py       workbook -> PostgreSQL loader (idempotent, reconciles)
scripts/verify.sql              12 invariant checks, exits non-zero on failure
server/                         read-only JSON API over the marts (Fastify + pg)
web/                            dashboard (Vite + React + TypeScript + Flowbite)
```

## Model

```mermaid
erDiagram
    dim_region ||--o{ dim_region : "parent_id"
    dim_region ||--o{ fact_birth : ""
    dim_region ||--o{ fact_maternal_death : ""
    dim_region ||--o{ fact_maternal_death_cause : ""
    dim_region ||--o{ fact_child_death : ""
    dim_region ||--o{ fact_child_death_cause : ""
    dim_period ||--o{ fact_birth : ""
    dim_period ||--o{ fact_maternal_death : ""
    dim_period ||--o{ fact_child_death : ""
    dim_age_band ||--o{ fact_child_death : ""
    dim_cause ||--o{ fact_maternal_death_cause : ""
    dim_cause ||--o{ fact_child_death_cause : ""
    etl_import_batch ||--o{ fact_birth : "provenance"

    dim_region {
        int region_id PK
        int parent_id FK
        text level "province|district|subdistrict|health_center"
        text name
        text bps_code
    }
    dim_period {
        smallint period_id PK
        smallint year
    }
    dim_cause {
        smallint cause_id PK
        text cause_group "maternal|neonatal|child"
        text name
    }
    dim_age_band {
        text age_band PK "neonatal|post_neonatal|child_1_4"
        int age_min_days
        int age_max_days
    }
    fact_birth {
        int region_id PK
        smallint period_id PK
        text sex PK
        int live_births
        int stillbirths
    }
    fact_maternal_death {
        int region_id PK
        smallint period_id PK
        text phase PK "pregnant|delivery|postpartum"
        int deaths
    }
    fact_maternal_death_cause {
        int region_id PK
        smallint period_id PK
        smallint cause_id PK
        int deaths
    }
    fact_child_death {
        int region_id PK
        smallint period_id PK
        text sex PK
        text age_band PK
        int deaths
    }
    fact_child_death_cause {
        int region_id PK
        smallint period_id PK
        smallint cause_id PK
        text age_band
        int deaths
    }
```

Marts (`db/02_views.sql`):

| View | Use |
|---|---|
| `mart.kpi_summary` | KPI cards: district AKI, AKB, AKN, under-5, counts, CIs |
| `mart.aki` | AKI by region and year, phase split, CI |
| `mart.akb` | AKB + AKN + under-5, age-band split, CI |
| `mart.akb_by_sex` | AKB split by sex, each with its own denominator |
| `mart.maternal_death_cause` | maternal cause breakdown + share |
| `mart.child_death_cause` | neonatal and child (12–59 month) cause breakdown + share |
| `mart.live_births_by_region` | shared denominator, including stillbirths |
| `dim.region_ancestry` | region → every ancestor, drives all rollups |

## Grain

Every fact row is stored **at puskesmas grain**. Districts and kecamatan are never
written into facts; they are summed through `dim.region_ancestry`, so a value can
only exist once and cannot be double counted.

| Fact table | Source table | Grain | Rows |
|---|---|---|---|
| `fact_birth` | 21 | puskesmas × year × sex | 40 |
| `fact_maternal_death` | 23 | puskesmas × year × phase | 60 |
| `fact_maternal_death_cause` | 25 | puskesmas × year × cause | 140 |
| `fact_child_death` | 34 | puskesmas × year × sex × age band | 120 |
| `fact_child_death_cause` | 36, 37 | puskesmas × year × cause | 400 |

Column mapping (Excel column letters → target). The columns marked *check* are
read by the loader to validate the row but are **not stored**, because they are
derivable and storing them would allow drift.

| Sheet | Columns | Target |
|---|---|---|
| 21 | C → puskesmas, B → kecamatan | `dim_region` |
| 21 | D/E, G/H | `fact_birth.live_births/stillbirths` per sex |
| 21 | J/K | *check*: M + F = total |
| 23 | D, E, F | `fact_maternal_death` pregnant / delivery / postpartum |
| 23 | G | *check*: phases sum to reported total |
| 25 | D–J | `fact_maternal_death_cause` (7 causes) |
| 25 | K | *check*: causes sum to reported total |
| 34 | D/E, F, G, H | M neonatal / post-neonatal / 12–59 month |
| 34 | I–M | F block (same order) |
| 34 | N–R | *check*: combined block = M + F, and bayi = neonatal + post |
| 36 | D–M | `fact_child_death_cause`, group `neonatal` |
| 37 | D–M | `fact_child_death_cause`, group `child`, band `child_1_4` |

## Why it looks like this

1. **Counts are stored, rates never are.** AKI and AKB are computed in the mart
   views from counts and live births, so a published figure can never disagree
   with its own numerator and denominator. `verify.sql` recomputes both rates
   and compares them to the views.
2. **Atomic age bands, not reported totals.** The source reports neonatal,
   post-neonatal, *bayi* and *anak balita*. Only the first, second and 12–59
   month bands are atomic; `bayi` and under-5 are derived. The workbook's own
   `bayi` column is used as a cross-check (it passes: 96 + 6 = 102).
3. **Puskesmas grain plus an ancestry view** instead of copying figures at three
   levels. Kecamatan Besuki gets its real denominator (1,008 = 631 Besuki +
   377 Widoropayung) with no second row to keep in sync.
4. **Confidence intervals instead of a "minimum denominator" cut-off.** One
   maternal death in 314 births is 318 per 100,000 — true but nearly meaningless.
   A Wilson 95% interval (56–1,782) says that honestly, and the dashboard can
   sort by lower bound or show the interval. No arbitrary `n >= 30` rule to
   defend.
5. **Cause tables are separate from phase/age tables.** Table 25 does not cross
   cause with phase, and table 36 does not cross cause with sex. Storing them
   separately keeps every table's grain honest, and the loader reconciles the
   totals (both are 11 and 96).
6. **`etl.import_batch` on every fact row.** A bad import can be identified,
   compared or rolled back. Reloads are idempotent upserts on the natural key;
   a failed reconciliation raises and rolls the whole transaction back.

## What the pilot produces

| Metric | Value | 95% CI |
|---|---|---|
| Live births | 9,924 | — |
| Maternal deaths | 11 (1 pregnant, 1 delivery, 9 postpartum) | — |
| **AKI** | **110.84 / 100,000** | 61.90 – 198.39 |
| Neonatal deaths | 96 (AKN 9.67 / 1,000) | — |
| Infant deaths | 102 | — |
| **AKB** | **10.28 / 1,000** | 8.47 – 12.46 |
| Under-5 deaths | 104 (10.48 / 1,000) | — |

Cross-checks that pass: every table TOTAL row, the Resume counts
(9,924 / 11 / 102), the published AKI (110.8424) and all 12 invariants.

Dashboard-ready detail:

- AKB by sex: male 12.54, female 7.88 per 1,000.
- Kecamatan AKB range: Mlandingan 2.74 → Bungatan 29.33 per 1,000.
- Maternal causes: non-obstetric 5 (45.5%), hypertension 4 (36.4%), haemorrhage 2 (18.2%).
- Neonatal causes: low birth weight/prematurity 49 (51.0%), respiratory/cardiovascular 28 (29.2%), other neonatal 17 (17.7%), congenital 2 (2.1%).

## Assumptions and known source issues

- **Province** is not named anywhere in the workbook (titles even say "PROVINSI
  SITUBONDO"). The loader defaults to `JAWA TIMUR` / BPS `35`; override with
  `--province` / `--province-bps`. District BPS `3512` is likewise a default,
  dropped automatically if the workbook's district is not Situbondo.
- **Three puskesmas have no kecamatan in any of the 88 tables**: Widoropayung,
  Klampokan, Wonorejo. They are mapped explicitly to Besuki, Panji and
  Banyuputih (their block in the workbook, and their actual location). The loader
  logs this, and logs any kecamatan it ever has to infer instead.
- **Province roll-up sheets 22, 24 and 35 are unusable in this copy.** 22 and 35
  are zero-filled templates; 24 has live births and deaths but every kabupaten
  label cell is empty, and row 18 has a blank total while its nifas cell says 1.
  They are not loaded; 23/25 are the source of truth.
- **Resume's AKB rate is `#DIV/0!`** (its male/female rate cells are 0), so only
  the infant count can be reconciled there. AKI is fine.
- The workbook's QA sheets (`Akurasi`, `Akurasi-2`, `Konsistensi*`) and table 31
  (`#REF!`) are outside this pilot.
- Empty count cells are read as 0 and reported as loader warnings. A blank that
  is *not* legitimately zero will fail a TOTAL reconciliation rather than pass
  silently.

## Run it

```bash
# 1. Postgres 16 in docker (host port 55432)
docker run -d --name profilkes-pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=profilkes \
  -p 55432:5432 postgres:16-alpine

# 2. Python deps
python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt

# 3. Schema, views, data
docker exec -i profilkes-pg psql -U postgres -d profilkes -f - < db/01_schema.sql
docker exec -i profilkes-pg psql -U postgres -d profilkes -f - < db/02_views.sql
.venv/bin/python scripts/load_profilkes.py profilkes_2025.xlsx

# 4. Invariants
docker exec -i profilkes-pg psql -U postgres -d profilkes -f - < scripts/verify.sql
```

Other database:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db \
  .venv/bin/python scripts/load_profilkes.py profilkes_2025.xlsx
```

The loader prints a reconciliation table; it exits non-zero and commits nothing
if any check fails. `db/01_schema.sql` is additive, so re-running is safe;
`db/00_reset.sql` rebuilds from scratch.

## Dashboard

Stack: Vite 8, React 19, TypeScript, Tailwind CSS v4, Flowbite React 0.12, and
ApexCharts via `react-apexcharts` (the chart pairing Flowbite documents).

```
server/src/index.ts      Fastify API, read-only, one route per mart
web/src/pages            Ringkasan, Kematian ibu, Kematian bayi, Penyebab, Data & mutu
web/src/components       Flowbite cards/badges/tables, Apex wrappers, the AKI interval plot
web/src/lib              fetch hook, Indonesian formatters, page metadata
```

API routes (all accept `year`, some accept `level=subdistrict|health_center|district`):

| Route | Mart |
|---|---|
| `GET /api/meta` | periods, region counts, last import batch |
| `GET /api/overview?year=` | `mart.kpi_summary` + `mart.akb_by_sex` + stillbirths |
| `GET /api/regions?year=&level=` | `mart.aki` joined with `mart.akb` |
| `GET /api/causes?year=&level=` | `mart.maternal_death_cause`, `mart.child_death_cause` |

```bash
# terminal 1: API on 127.0.0.1:8787 (DATABASE_URL defaults to the docker DSN)
cd server && npm install && npm run dev

# terminal 2: dashboard on 127.0.0.1:5173, /api proxied to the API
cd web && npm install && npm run dev
```

`npm run build` in `web/` type-checks and produces `web/dist`. Pages are lazy
loaded, so ApexCharts (~270 kB gzipped) only downloads when a chart page opens.
The app calls relative `/api` paths, so in production serve `web/dist` behind a
proxy that forwards `/api` to the Fastify service.

### What the dashboard does with the data

- **KPI cards** carry the figure, the 95% interval, and the raw counts, so a rate
  is never shown without its denominator.
- **AKB per kecamatan** colours a bar only when its whole interval sits above or
  below the district rate; otherwise the difference is not called out.
- **AKI per kecamatan** is a dot-and-interval plot rather than a bar, because a
  bar makes 1 death in 314 births look five times worse than the district.
- **Penyebab** shows shares within each group (ibu, neonatal, anak balita) and
  keeps zero-death categories visible in the footnote.
- **Data & mutu** exposes the import batch, coverage, formulas and the known
  source problems from this README.

### Dashboard checks

Verified against the running app with headless Chrome (DevTools protocol) at
1440×900 and 390×844: every route renders its content, charts mount, the table
has 17 rows, there is no horizontal overflow, the mobile drawer opens/closes, and
the console reports no errors. `npm run lint` (oxlint) reports 0 warnings and 0
errors; `npm run build` and `tsc --noEmit` in `server/` pass.

Not included: authentication, pagination and CSV export. The API is read-only
and unauthenticated, so it should sit behind the office network or a proxy that
adds auth before it is exposed publicly.

## Extending beyond the pilot

- **Another indicator family** (immunisation, TB, sanitation…): add one fact
  table at puskesmas grain, reuse `dim_region`, `dim_period`, `dim_age_band` and
  `dim_cause`. Do not widen the AKI/AKB tables.
- **The 100 Resume indicators**: they are district-level and already expressed as
  percentages, so they need `dim_indicator` + a narrow `fact_indicator_value`.
  Deliberately out of scope here — the decision was pilot-only.
- **More districts or years**: `dim_period` is keyed by year and facts carry
  `period_id`, so a second workbook for another year or kabupaten loads into the
  same tables. `mart.*` already expose `level`, so district comparisons work
  without a schema change.
- **Front end**: cards from `mart.kpi_summary`; tables from `mart.aki` /
  `mart.akb`; donuts from `mart.maternal_death_cause` / `mart.child_death_cause`.

### Open questions for the full build

1. Should kecamatan AKI be shown at all, or only AKB counts plus intervals? Eleven
   deaths across 17 kecamatan makes AKI a very noisy map.
2. Is "reported" AKI (workbook figure) needed alongside the computed one for audit,
   or is the computed figure the only number shown?
3. Do you need monthly/quarterly data later? That would make `dim_period` a real
   date dimension rather than a year.
