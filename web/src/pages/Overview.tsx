import { ChartCard, TableCard } from "../components/ChartCard";
import { AkbBarChart, CauseBarChart, SexBarChart, SignalLegend } from "../components/charts";
import { KpiCard } from "../components/KpiCard";
import { RateRangePlot } from "../components/RateRangePlot";
import { RegionTable } from "../components/RegionTable";
import { ErrorBlock, LoadingBlock } from "../components/States";
import {
  confidenceInterval,
  formatCount,
  formatPercent,
  formatRate,
  shortCause,
} from "../lib/format";
import { useApi } from "../lib/useApi";
import type { CausesResponse, OverviewResponse, RegionsResponse } from "../types";

export function OverviewPage({ year }: { year: number }) {
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

  const { kpi, sex, stillbirths } = overview.data;
  const rows = regions.data?.rows ?? [];
  const maternalCauses = (causes.data?.maternal ?? []).filter(
    (cause) => cause.deaths > 0,
  );
  const neonatalCauses = (causes.data?.child ?? []).filter(
    (cause) => cause.causeGroup === "neonatal" && cause.deaths > 0,
  );
  const topNeonatal = [...neonatalCauses].sort((a, b) => b.deaths - a.deaths)[0];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Kematian ibu dan bayi, {kpi.year}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
              Tercatat <strong>{formatCount(kpi.maternalDeaths)} kematian ibu</strong>{" "}
              dari {formatCount(kpi.liveBirths)} kelahiran hidup (AKI{" "}
              {formatRate(kpi.akiPer100k)} per 100.000). Kematian bayi{" "}
              <strong>{formatCount(kpi.infantDeaths)}</strong> (AKB{" "}
              {formatRate(kpi.akbPer1000)} per 1.000), {kpi.neonatalDeaths} di
              antaranya neonatal
              {topNeonatal
                ? `, dengan penyebab terbanyak ${shortCause(topNeonatal.cause).toLowerCase()} (${formatCount(
                    topNeonatal.deaths,
                  )} kematian, ${formatPercent(topNeonatal.sharePercent)}).`
                : "."}
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Sumber: Profil Kesehatan {kpi.year} · tabel 21, 23, 25, 34, 36, 37
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Angka Kematian Ibu"
          value={formatRate(kpi.akiPer100k)}
          unit="per 100.000 KH"
          ci={confidenceInterval(kpi.akiCi95Low, kpi.akiCi95High)}
          note={`${formatCount(kpi.maternalDeaths)} kematian ibu dari ${formatCount(
            kpi.liveBirths,
          )} kelahiran hidup.`}
        />
        <KpiCard
          label="Angka Kematian Bayi"
          value={formatRate(kpi.akbPer1000)}
          unit="per 1.000 KH"
          ci={confidenceInterval(kpi.akbCi95Low, kpi.akbCi95High)}
          note={`${formatCount(kpi.infantDeaths)} kematian bayi; ${formatCount(
            kpi.neonatalDeaths,
          )} neonatal dan ${formatCount(kpi.infantDeaths - kpi.neonatalDeaths)} post-neonatal.`}
        />
        <KpiCard
          label="Angka Kematian Neonatal"
          value={formatRate(kpi.aknPer1000)}
          unit="per 1.000 KH"
          note={`${formatCount(kpi.neonatalDeaths)} kematian pada 0–28 hari, ${formatPercent(
            (kpi.neonatalDeaths / Math.max(kpi.infantDeaths, 1)) * 100,
          )} dari seluruh kematian bayi.`}
        />
        <KpiCard
          label="Lahir hidup"
          value={formatCount(kpi.liveBirths)}
          unit="kelahiran"
          note={
            stillbirths
              ? `${formatCount(stillbirths.stillbirths)} lahir mati (${formatRate(
                  stillbirths.stillbirthsPer1000,
                )} per 1.000 kelahiran hidup + mati).`
              : "Jumlah kelahiran hidup sebagai penyebut seluruh angka."
          }
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
                Warna menunjukkan apakah seluruh selang kepercayaan 95% berada di
                atas atau di bawah angka kabupaten ({formatRate(kpi.akbPer1000)}).
                Dengan 17 kecamatan, satu kematian menggeser angka cukup jauh,
                sehingga perbedaan kecil sebaiknya dibaca sebagai kesetaraan.
              </p>
            </div>
          }
        >
          <AkbBarChart rows={rows} reference={kpi.akbPer1000} />
        </ChartCard>

        <ChartCard
          title="AKI menurut kecamatan"
          subtitle="Per 100.000 kelahiran hidup dengan selang kepercayaan 95%"
          footer={
            <div className="space-y-2">
              <p>
                Titik adalah angka AKI, garis adalah selang kepercayaan 95%.
                Kecamatan dengan 0–1 kematian memiliki selang sangat lebar: angka
                tinggi di kecamatan kecil belum tentu mencerminkan risiko yang
                berbeda.
              </p>
            </div>
          }
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
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="AKB menurut jenis kelamin"
          subtitle="Laki-laki dan perempuan memiliki penyebut kelahiran masing-masing"
          footer={
            <ul className="grid gap-1 sm:grid-cols-2">
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

        <ChartCard
          title="Penyebab kematian ibu"
          subtitle={`${formatCount(kpi.maternalDeaths)} kematian, tujuh kategori penyebab`}
          footer={
            <p>
              Kategori tanpa kematian tidak ditampilkan. Rincian lengkap ada di
              halaman Penyebab.
            </p>
          }
        >
          {maternalCauses.length > 0 ? (
            <CauseBarChart
              data={maternalCauses.map((cause) => ({
                name: cause.cause,
                deaths: cause.deaths,
                share: cause.sharePercent,
              }))}
              color="#be123c"
            />
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              Tidak ada kematian ibu tercatat.
            </p>
          )}
        </ChartCard>
      </div>

      <TableCard
        title="Angka menurut kecamatan"
        subtitle="Klik judul kolom untuk mengurutkan"
        footer="KH = kelahiran hidup. Selang kepercayaan 95% dihitung dengan metode Wilson dari jumlah kematian dan kelahiran hidup."
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
