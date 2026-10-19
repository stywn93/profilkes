import { ChartCard, TableCard } from "../components/ChartCard";
import { AkbBarChart, SexBarChart, SignalLegend } from "../components/charts";
import { KpiCard } from "../components/KpiCard";
import { RegionTable } from "../components/RegionTable";
import { ErrorBlock, LoadingBlock } from "../components/States";
import {
  confidenceInterval,
  formatCount,
  formatPercent,
  formatRate,
} from "../lib/format";
import { useApi } from "../lib/useApi";
import type { OverviewResponse, RegionsResponse } from "../types";

interface Segment {
  label: string;
  value: number;
  color: string;
}

function CompositionBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {segments.map((segment) => (
          <div
            key={segment.label}
            style={{
              width: `${total ? (segment.value / total) * 100 : 0}%`,
              backgroundColor: segment.color,
            }}
            title={`${segment.label}: ${segment.value}`}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-2 text-xs text-slate-600">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              {segment.label}
            </span>
            <span className="tabular-nums text-slate-800">
              {formatCount(segment.value)}
              <span className="ml-1 text-slate-400">
                ({formatPercent(total ? (segment.value / total) * 100 : 0)})
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AkbPage({ year }: { year: number }) {
  const overview = useApi<OverviewResponse>(`/api/overview?year=${year}`);
  const regions = useApi<RegionsResponse>(
    `/api/regions?year=${year}&level=subdistrict`,
  );

  const error = overview.error ?? regions.error;
  if (error) return <ErrorBlock message={error} />;
  if (overview.loading || regions.loading || !overview.data) {
    return <LoadingBlock />;
  }

  const { kpi, sex } = overview.data;
  const rows = regions.data?.rows ?? [];
  const postNeonatal = kpi.infantDeaths - kpi.neonatalDeaths;
  const child14 = kpi.under5Deaths - kpi.infantDeaths;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Angka Kematian Bayi"
          value={formatRate(kpi.akbPer1000)}
          unit="per 1.000 KH"
          ci={confidenceInterval(kpi.akbCi95Low, kpi.akbCi95High)}
          note={`${formatCount(kpi.infantDeaths)} kematian bayi dari ${formatCount(
            kpi.liveBirths,
          )} kelahiran hidup.`}
        />
        <KpiCard
          label="Neonatal (0–28 hari)"
          value={formatRate(kpi.aknPer1000)}
          unit="per 1.000 KH"
          note={`${formatCount(kpi.neonatalDeaths)} kematian, ${formatPercent(
            (kpi.neonatalDeaths / Math.max(kpi.infantDeaths, 1)) * 100,
          )} dari kematian bayi.`}
          emphasis="muted"
        />
        <KpiCard
          label="Post-neonatal (29 hari–11 bulan)"
          value={formatCount(postNeonatal)}
          unit="kematian"
          note={`Setara ${formatRate(
            (postNeonatal / Math.max(kpi.liveBirths, 1)) * 1000,
          )} per 1.000 kelahiran hidup.`}
          emphasis="muted"
        />
        <KpiCard
          label="Balita (0–59 bulan)"
          value={formatRate(kpi.akbalitaPer1000)}
          unit="per 1.000 KH"
          note={`${formatCount(kpi.under5Deaths)} kematian, termasuk ${formatCount(
            child14,
          )} anak usia 12–59 bulan.`}
          emphasis="muted"
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="AKB menurut kecamatan"
          subtitle="Kematian bayi per 1.000 kelahiran hidup"
          footer={
            <div className="space-y-2">
              <SignalLegend />
              <p>
                Perbedaan yang tidak melewati batas kabupaten (
                {formatRate(kpi.akbPer1000)}) ditandai abu-abu meskipun angkanya
                terlihat jauh, karena jumlah kematian per kecamatan kecil.
              </p>
            </div>
          }
        >
          <AkbBarChart rows={rows} reference={kpi.akbPer1000} />
        </ChartCard>

        <div className="space-y-4">
          <ChartCard
            title="Komposisi kematian balita"
            subtitle="Neonatal, post-neonatal, dan 12–59 bulan"
            footer="Usia balita 12–59 bulan hanya menyumbang sebagian kecil; sebagian besar kematian terjadi pada 28 hari pertama."
          >
            <CompositionBar
              segments={[
                {
                  label: "Neonatal (0–28 hari)",
                  value: kpi.neonatalDeaths,
                  color: "#0369a1",
                },
                {
                  label: "Post-neonatal (29 hari–11 bulan)",
                  value: postNeonatal,
                  color: "#38bdf8",
                },
                {
                  label: "Anak balita (12–59 bulan)",
                  value: child14,
                  color: "#f59e0b",
                },
              ]}
            />
          </ChartCard>

          <ChartCard
            title="AKB menurut jenis kelamin"
            subtitle={`Laki-laki ${formatCount(sex.find((s) => s.sex === "M")?.infantDeaths ?? 0)} kematian · perempuan ${formatCount(
              sex.find((s) => s.sex === "F")?.infantDeaths ?? 0,
            )} kematian`}
            footer={
              <ul className="space-y-1">
                {sex.map((row) => (
                  <li key={row.sex}>
                    {row.sex === "M" ? "Laki-laki" : "Perempuan"}:{" "}
                    {formatCount(row.infantDeaths)} dari {formatCount(row.liveBirths)}{" "}
                    kelahiran hidup
                  </li>
                ))}
              </ul>
            }
          >
            <SexBarChart rows={sex} />
          </ChartCard>
        </div>
      </div>

      <TableCard
        title="Rincian per kecamatan"
        subtitle="Klik judul kolom untuk mengurutkan"
        footer="KH = kelahiran hidup. Sinyal AKB membandingkan selang kepercayaan kecamatan dengan angka kabupaten."
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
