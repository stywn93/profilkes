import { useApi } from "../lib/useApi";
import { formatDate } from "../lib/format";
import { ErrorBlock, LoadingBlock } from "../components/States";
import type { Meta } from "../types";

const LEVEL_LABEL: Record<string, string> = {
  province: "Provinsi",
  district: "Kabupaten/kota",
  subdistrict: "Kecamatan",
  health_center: "Puskesmas",
};

const CAVEATS: { title: string; body: string }[] = [
  {
    title: "Nama provinsi tidak ada di berkas",
    body: "Seluruh judul hanya menyebut kabupaten; bahkan tabel 22–24 menuliskan “PROVINSI SITUBONDO”. Provinsi diisi Jawa Timur dan dapat diubah saat memuat ulang.",
  },
  {
    title: "Tiga puskesmas tanpa kecamatan",
    body: "Widoropayung, Klampokan, dan Wonorejo tidak memiliki nama kecamatan di seluruh 88 tabel. Ketiganya dipetakan ke Besuki, Panji, dan Banyuputih sesuai blok barisnya.",
  },
  {
    title: "Rekap provinsi tidak dapat dipakai",
    body: "Tabel 22 dan 35 berisi nol; tabel 24 memiliki angka tetapi seluruh label kabupaten kosong. Data diambil dari tabel 21, 23, 25, 34, 36, dan 37.",
  },
  {
    title: "Angka AKB di lembar Resume rusak",
    body: "Sel angka AKB pada Resume bernilai #DIV/0!, sehingga angka pada dashboard dihitung ulang dari jumlah kematian dan kelahiran hidup, lalu dicocokkan dengan hitungan Resume.",
  },
  {
    title: "Kematian per kecamatan sangat sedikit",
    body: "AKI kecamatan dibentuk dari 0–2 kematian. Selang kepercayaan 95% ditampilkan agar perbedaan kecil tidak dibaca sebagai perbedaan risiko.",
  },
  {
    title: "Penyebab tidak disilangkan",
    body: "Tabel 25 dan 36 tidak memecah penyebab menurut fase kehamilan atau jenis kelamin, sehingga penyebab dan fase disimpan sebagai fakta terpisah.",
  },
];

export function DataQualityPage() {
  const meta = useApi<Meta>("/api/meta");

  if (meta.error) return <ErrorBlock message={meta.error} />;
  if (meta.loading || !meta.data) return <LoadingBlock />;

  const { batch, levels } = meta.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Batch impor terakhir</h2>
          <dl className="mt-3 divide-y divide-slate-100 text-xs">
            {[
              ["Berkas", batch?.sourceFile ?? "—"],
              ["Tahun sumber", batch?.sourceYear?.toString() ?? "—"],
              ["Kabupaten", batch?.district ?? "—"],
              ["Dimuat", formatDate(batch?.loadedAt)],
              ["SHA-256", batch?.sha256 ? `${batch.sha256.slice(0, 16)}…` : "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 py-2">
                <dt className="text-slate-500">{label}</dt>
                <dd
                  className="max-w-[60%] truncate text-right font-medium text-slate-800"
                  title={value}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Setiap baris fakta menyimpan id batch, sehingga data dapat ditelusuri
            kembali ke berkas sumbernya.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Cakupan wilayah</h2>
          <table className="mt-3 w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-1.5 font-semibold">
                  Level
                </th>
                <th scope="col" className="py-1.5 text-right font-semibold">
                  Jumlah
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(levels)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([level, count]) => (
                  <tr key={level}>
                    <td className="py-1.5 text-slate-700">
                      {LEVEL_LABEL[level] ?? level}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-slate-800">
                      {count}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Fakta disimpan pada level puskesmas lalu dijumlahkan ke kecamatan,
            kabupaten, dan provinsi melalui relasi hierarki.
          </p>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Rumus angka</h2>
        <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="font-medium text-slate-800">AKI</p>
            <p className="mt-1 font-mono text-[11px] text-slate-600">
              kematian ibu ÷ lahir hidup × 100.000
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="font-medium text-slate-800">AKB</p>
            <p className="mt-1 font-mono text-[11px] text-slate-600">
              (neonatal + post-neonatal) ÷ lahir hidup × 1.000
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="font-medium text-slate-800">AKN</p>
            <p className="mt-1 font-mono text-[11px] text-slate-600">
              kematian neonatal ÷ lahir hidup × 1.000
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="font-medium text-slate-800">Selang kepercayaan</p>
            <p className="mt-1 font-mono text-[11px] text-slate-600">
              Wilson score interval, 95%
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Catatan kualitas data</h2>
        <ul className="mt-3 space-y-3">
          {CAVEATS.map((caveat) => (
            <li key={caveat.title} className="text-xs leading-relaxed">
              <p className="font-medium text-slate-800">{caveat.title}</p>
              <p className="mt-0.5 text-slate-600">{caveat.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Verifikasi ulang</h2>
        <p className="mt-1 text-xs text-slate-600">
          Pemeriksaan rekonsiliasi dijalankan setiap kali memuat data; invarian
          database dapat diperiksa kapan saja:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 px-4 py-3 text-[11px] leading-relaxed text-slate-100">
          <code>{`python scripts/load_profilkes.py profilkes_2025.xlsx
psql "$DATABASE_URL" -f scripts/verify.sql`}</code>
        </pre>
      </section>
    </div>
  );
}
