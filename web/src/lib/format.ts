const rateFormat = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const intFormat = new Intl.NumberFormat("id-ID");

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatRate(value?: number | null): string {
  return value === null || value === undefined ? "—" : rateFormat.format(value);
}

export function formatCount(value?: number | null): string {
  return value === null || value === undefined ? "—" : intFormat.format(value);
}

export function formatPercent(value?: number | null): string {
  return value === null || value === undefined ? "—" : `${rateFormat.format(value)}%`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
}

export function confidenceInterval(
  low?: number | null,
  high?: number | null,
): string {
  if (low === null || low === undefined || high === null || high === undefined) {
    return "—";
  }
  return `${formatRate(low)}–${formatRate(high)}`;
}

export type Signal = "higher" | "similar" | "lower";

/**
 * Compare a region's interval with the district reference rate.
 * "higher" only when the whole interval sits above the reference, so a single
 * death in a small kecamatan does not get presented as a real difference.
 */
export function classify(
  low?: number | null,
  high?: number | null,
  reference?: number | null,
): Signal | null {
  if (
    low === null ||
    low === undefined ||
    high === null ||
    high === undefined ||
    reference === null ||
    reference === undefined
  ) {
    return null;
  }
  if (low > reference) return "higher";
  if (high < reference) return "lower";
  return "similar";
}

export const SIGNAL_LABEL: Record<Signal, string> = {
  higher: "Di atas kabupaten",
  similar: "Setara kabupaten",
  lower: "Di bawah kabupaten",
};

// The workbook stores cause names in full administrative uppercase; these are
// display-only shortenings so chart axes stay readable.
const CAUSE_LABELS: Record<string, string> = {
  "KOMPLIKASI ABORTUS": "Abortus",
  "HIPERTENSI DALAM KEHAMILAN, PERSALINAN DAN NIFAS": "Hipertensi kehamilan",
  "PERDARAHAN OBSTETRIK": "Perdarahan obstetrik",
  "INFEKSI TERKAIT KEHAMILAN": "Infeksi kehamilan",
  "KOMPLIKASI OBSTETRIK LAIN": "Komplikasi obstetrik lain",
  "KOMPLIKASI MANAJEMEN YANG TIDAK TERANTISIPASI":
    "Manajemen tak terantisipasi",
  "KOMPLIKASI NON OBSTETRIK": "Non-obstetrik",
  "MALFORMASI KONGENITAL, DEFORMASI, DAN KELAINAN KROMOSOM":
    "Malformasi kongenital",
  "GANGGUAN TERKAIT USIA KEHAMILAN DAN PERTUMBUHAN JANIN":
    "Usia kehamilan & pertumbuhan",
  "TRAUMA KELAHIRAN": "Trauma kelahiran",
  "KOMPLIKASI PADA SAAT PERSALINAN (INTRAPARTUM)": "Komplikasi intrapartum",
  "KEJANG DAN GANGGUAN STATUS SEREBRAL": "Kejang neonatal",
  "GANGGUAN PERNAPASAN DAN KARDIOVASKULAR": "Pernapasan & kardiovaskular",
  "KONDISI NEONATAL LAINNYA": "Kondisi neonatal lain",
  "BERAT BADAN LAHIR RENDAH DAN PREMATURITAS": "BBLR & prematuritas",
  "KEMATIAN NEONATAL DENGAN PENYEBAB YANG TIDAK DITENTUKAN":
    "Tidak ditentukan",
  "DIARE": "Diare",
  "DEMAM BERDARAH": "Demam berdarah",
  "PNEUMONIA": "Pneumonia",
  "KELAINAN KONGENITAL JANTUNG": "Kelainan jantung bawaan",
  "PD3I": "PD3I",
  "PENYAKIT SARAF": "Penyakit saraf",
  "KELAINAN KONGENITAL LAINNYA": "Kelainan bawaan lain",
  "TENGGELAM, CEDERA, KECELAKAAN": "Cedera & kecelakaan",
  "INFEKSI PARASIT": "Infeksi parasit",
  "LAIN-LAIN": "Lain-lain",
};

export function shortCause(name: string): string {
  return CAUSE_LABELS[name.trim().toUpperCase()] ?? name;
}

/** "SUMBERMALANG" -> "Sumbermalang" for display only. */
export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s(])([a-z])/g, (_, prefix: string, letter: string) =>
      `${prefix}${letter.toUpperCase()}`,
    );
}
