import { ChartCard } from "../components/ChartCard";
import { CauseBarChart } from "../components/charts";
import { ErrorBlock, LoadingBlock } from "../components/States";
import { formatCount, formatPercent, shortCause } from "../lib/format";
import { useApi } from "../lib/useApi";
import type { CausesResponse, OverviewResponse } from "../types";

export function CausesPage({ year }: { year: number }) {
  const overview = useApi<OverviewResponse>(`/api/overview?year=${year}`);
  const causes = useApi<CausesResponse>(`/api/causes?year=${year}`);

  const error = overview.error ?? causes.error;
  if (error) return <ErrorBlock message={error} />;
  if (overview.loading || causes.loading || !overview.data || !causes.data) {
    return <LoadingBlock />;
  }

  const maternal = causes.data.maternal;
  const child = causes.data.child;
  const neonatal = child.filter((row) => row.causeGroup === "neonatal");
  const childCauses = child.filter((row) => row.causeGroup === "child");

  const maternalZero = maternal.filter((row) => row.deaths === 0);
  const neonatalZero = neonatal.filter((row) => row.deaths === 0);
  const childZero = childCauses.filter((row) => row.deaths === 0);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <p className="text-sm leading-relaxed text-slate-600">
          Penyebab kematian dilaporkan terpisah dari fase kehamilan dan jenis
          kelamin, sehingga tabel di bawah tidak disilangkan dengan keduanya.
          Total penyebab tetap sama dengan total kematian:{" "}
          {formatCount(overview.data.kpi.maternalDeaths)} kematian ibu dan{" "}
          {formatCount(overview.data.kpi.neonatalDeaths)} kematian neonatal.
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Penyebab kematian ibu"
          subtitle={`${formatCount(
            maternal.reduce((sum, row) => sum + row.deaths, 0),
          )} kematian · tabel 25`}
          footer={
            maternalZero.length > 0 ? (
              <p>
                Tanpa kematian:{" "}
                {maternalZero.map((row) => shortCause(row.cause)).join(", ")}.
              </p>
            ) : (
              <p>Seluruh kategori penyebab memiliki kematian.</p>
            )
          }
        >
          <CauseBarChart
            data={maternal
              .filter((row) => row.deaths > 0)
              .map((row) => ({
                name: row.cause,
                deaths: row.deaths,
                share: row.sharePercent,
              }))}
            color="#be123c"
          />
        </ChartCard>

        <ChartCard
          title="Penyebab kematian neonatal"
          subtitle={`${formatCount(
            neonatal.reduce((sum, row) => sum + row.deaths, 0),
          )} kematian · tabel 36`}
          footer={
            neonatalZero.length > 0 ? (
              <p>
                Tanpa kematian:{" "}
                {neonatalZero.map((row) => shortCause(row.cause)).join(", ")}.
              </p>
            ) : (
              <p>Seluruh kategori penyebab memiliki kematian.</p>
            )
          }
        >
          <CauseBarChart
            data={neonatal
              .filter((row) => row.deaths > 0)
              .map((row) => ({
                name: row.cause,
                deaths: row.deaths,
                share: row.sharePercent,
              }))}
            color="#c2410c"
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Penyebab kematian anak balita (12–59 bulan)"
        subtitle={`${formatCount(
          childCauses.reduce((sum, row) => sum + row.deaths, 0),
        )} kematian · tabel 37`}
        footer={
          childZero.length > 0 ? (
            <p>
              {formatCount(childZero.length)} dari {formatCount(childCauses.length)}{" "}
              kategori tidak memiliki kematian:{" "}
              {childZero.map((row) => shortCause(row.cause)).join(", ")}.
            </p>
          ) : null
        }
      >
        <CauseBarChart
          data={childCauses
            .filter((row) => row.deaths > 0)
            .map((row) => ({
              name: row.cause,
              deaths: row.deaths,
              share: row.sharePercent,
            }))}
          color="#0369a1"
          height={120}
        />
      </ChartCard>

      <section className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Cara membaca</h2>
        <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-600">
          <li>
            Persentase adalah proporsi terhadap seluruh kematian pada kelompok yang
            sama (ibu, neonatal, atau anak balita), bukan terhadap seluruh kematian.
          </li>
          <li>
            Kematian dengan penyebab tidak ditentukan tetap ditampilkan; pada data
            ini {formatPercent(
              neonatal.find((row) =>
                row.cause.includes("TIDAK DITENTUKAN"),
              )?.sharePercent ?? 0,
            )}{" "}
            kematian neonatal tidak memiliki penyebab yang jelas.
          </li>
          <li>
            Jumlah kematian kecil (mis. 2 kematian balita) membuat peringkat penyebab
            tidak stabil antar tahun.
          </li>
        </ul>
      </section>
    </div>
  );
}
