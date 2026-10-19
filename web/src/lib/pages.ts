export type PageKey = "ringkasan" | "aki" | "akb" | "penyebab" | "data";

export const PAGES: Record<PageKey, { title: string; subtitle: string }> = {
  ringkasan: {
    title: "Ringkasan",
    subtitle: "Kematian ibu dan bayi, Kabupaten Situbondo",
  },
  aki: {
    title: "Kematian ibu",
    subtitle: "Angka Kematian Ibu menurut kecamatan",
  },
  akb: {
    title: "Kematian bayi",
    subtitle: "Angka Kematian Bayi, neonatal, dan balita",
  },
  penyebab: {
    title: "Penyebab",
    subtitle: "Penyebab kematian ibu, neonatal, dan anak balita",
  },
  data: {
    title: "Data & mutu",
    subtitle: "Sumber, cakupan, dan catatan keterbatasan data",
  },
};

export function isPageKey(value: string): value is PageKey {
  return value in PAGES;
}
