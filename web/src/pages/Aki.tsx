import { ChartCard, TableCard } from "../components/ChartCard";
import { CauseBarChart } from "../components/charts";
import { KpiCard } from "../components/KpiCard";
import { RateRangePlot } from "../components/RateRangePlot";
import { RegionTable } from "../components/RegionTable";
import { ErrorBlock, LoadingBlock } from "../components/States";
import {
  confidenceInterval,
  formatCount,
  formatPercent,
  formatRate,
} from "../lib/format";
import { useApi } from "../lib/useApi";
import type { CausesResponse, OverviewResponse, RegionsResponse } from "../types";

const PHASES = [
  { key: "deathsPregnant", label: "Masa kehamilan" },
  { key: "deathsDelivery", label: "Masa persalinan" },
  { key: "deathsPostpartum", label: "Masa nifas" },
] as const;

export function AkiPage({ year }: { year: number }) {
  const overview = useApi<OverviewResponse>(`/api/overview?year=${year}`);
  const regions = useApi<RegionsResponse>(
    `/api/regions?year=${year}&level=subdistrict`,
  );
  const causes = useApi<CausesResponse>(`/api/causes?year=${year}`);

  const error = overview.error ?? regions.error ?? causes.error;
  if (error) return <ErrorBlock message={error} />;
  if (overview.loading || regions.loading || causes.loading || !overview.data) {
    return <LoadingBlock />;
  }

  const { kpi } = overview.data;
  const rows = regions.data?.rows ?? [];
  const maternalCauses = causes.data?.maternal ?? [];
  const causeTotal = maternalCauses.reduce((sum, cause) => sum + cause.deaths, 0);
  const zeroCauses = maternalCauses.filter((cause) => cause.deaths === 0);
  const withoutDeaths = rows.filter((row) => row.maternalDeaths === 0).length;

  const phases = PHASES.map((phase) => ({
    ...phase,
    deaths: rows.reduce((sum, row) => sum + row[phase.key], 0),
  }));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Angka Kematian Ibu"
          value={formatRate(kpi.akiPer100k)}
          unit="per 100.000 KH"
          ci={confidenceInterval(kpi.akiCi95Low, kpi.akiCi95High)}
          note={`Selang kepercayaan lebar karena hanya ${formatCount(
            kpi.maternalDeaths,
          )} kematian dari ${formatCount(kpi.liveBirths)} kelahiran hidup.`}
        />
        <KpiCard
          label="Kematian ibu"
          value={formatCount(kpi.maternalDeaths)}
          unit="kematian"
          note={`Tercatat pada ${PHASES.length} fase: kehamilan, persalinan, dan nifas.`}
          emphasis="muted"
        />
        <KpiCard
          label="Lahir hidup"
          value={formatCount(kpi.liveBirths)}
          unit="kelahiran"
          note="Penyebut AKI; sama dengan total kelahiran hidup tabel 21."
          emphasis="muted"
        />
        <KpiCard
          label="Kecamatan tanpa kematian ibu"
          value={`${withoutDeaths} dari ${rows.length}`}
          unit="kecamatan"
          note="Kecamatan dengan nol kematian tetap memiliki risiko yang tidak bisa disimpulkan dari angka nol."
          emphasis="muted"
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {phases.map((phase) => {
          const share = kpi.maternalDeaths
            ? (phase.deaths / kpi.maternalDeaths) * 100
            : 0;
          return (
            <div
              key={phase.key}
              className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {phase.label}
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums text-slate-900">
                  {formatCount(phase.deaths)}
                </span>
                <span className="text-xs text-slate-500">
                  kematian · {formatPercent(share)}
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-rose-500"
                  style={{ width: `${Math.min(share, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="AKI menurut kecamatan"
          subtitle="Angka dan selang kepercayaan 95%"
          footer="Titik = angka AKI. Garis = selang kepercayaan 95% (Wilson). Garis putus-putus = angka kabupaten."
        >
          <RateRangePlot
            rows={rows.map((row) => ({
              name: row.regionName,
              value: row.akiPer100k,
              low: row.akiCi95Low,
              high: row.akiCi95High,
              deaths: row.maternalDeaths,
            }))}
            reference={kpi.akiPer100k}
            referenceLabel="Kabupaten"
            unit="per 100.000 KH"
          />
        </ChartCard>

        <ChartCard
          title="Penyebab kematian ibu"
          subtitle={`${formatCount(causeTotal)} kematian dalam tujuh kategori`}
          footer={
            zeroCauses.length > 0 ? (
              <p>
                Tanpa kematian:{" "}
                {zeroCauses.map((cause) => cause.cause.toLowerCase()).join(", ")}.
              </p>
            ) : (
              <p>Seluruh kategori penyebab memiliki kematian.</p>
            )
          }
        >
          <CauseBarChart
            data={maternalCauses
              .filter((cause) => cause.deaths > 0)
              .map((cause) => ({
                name: cause.cause,
                deaths: cause.deaths,
                share: cause.sharePercent,
              }))}
            color="#be123c"
          />
        </ChartCard>
      </div>

      <TableCard
        title="Rincian per kecamatan"
        subtitle="Klik judul kolom untuk mengurutkan"
        footer="KH = kelahiran hidup. Angka 0 pada kecamatan kecil tidak berarti risiko nol; lihat selang kepercayaan."
      >
        <RegionTable
          rows={rows}
          reference={kpi.akbPer1000}
          caption="AKI dan AKB menurut kecamatan"
        />
      </TableCard>
    </div>
  );
}
