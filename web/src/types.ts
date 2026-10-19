export type Level = "subdistrict" | "health_center" | "district";

export interface Meta {
  years: number[];
  batch: {
    sourceFile: string;
    loadedAt: string;
    sha256: string;
    district: string | null;
    sourceYear: number | null;
  } | null;
  levels: Record<string, number>;
  province: string | null;
  district: string | null;
}

export interface Kpi {
  regionName: string;
  year: number;
  liveBirths: number;
  maternalDeaths: number;
  akiPer100k: number | null;
  akiCi95Low: number | null;
  akiCi95High: number | null;
  neonatalDeaths: number;
  infantDeaths: number;
  under5Deaths: number;
  aknPer1000: number | null;
  akbPer1000: number | null;
  akbalitaPer1000: number | null;
  akbCi95Low: number | null;
  akbCi95High: number | null;
}

export interface Stillbirths {
  liveBirths: number;
  stillbirths: number;
  stillbirthsPer1000: number | null;
}

export interface SexRow {
  sex: "M" | "F";
  liveBirths: number;
  infantDeaths: number;
  akbPer1000: number | null;
}

export interface OverviewResponse {
  kpi: Kpi;
  sex: SexRow[];
  stillbirths: Stillbirths | null;
}

export interface RegionRow {
  regionId: number;
  regionName: string;
  level: Level;
  liveBirths: number;
  maternalDeaths: number;
  deathsPregnant: number;
  deathsDelivery: number;
  deathsPostpartum: number;
  akiPer100k: number | null;
  akiCi95Low: number | null;
  akiCi95High: number | null;
  neonatalDeaths: number;
  postNeonatalDeaths: number;
  infantDeaths: number;
  child14Deaths: number;
  under5Deaths: number;
  aknPer1000: number | null;
  akbPer1000: number | null;
  akbalitaPer1000: number | null;
  akbCi95Low: number | null;
  akbCi95High: number | null;
}

export interface RegionsResponse {
  year: number;
  level: Level;
  rows: RegionRow[];
}

export interface MaternalCause {
  cause: string;
  deaths: number;
  sharePercent: number | null;
  sortOrder: number;
}

export interface ChildCause {
  causeGroup: "neonatal" | "child";
  cause: string;
  deaths: number;
  sharePercent: number | null;
  sortOrder: number;
}

export interface CausesResponse {
  year: number;
  level: Level;
  maternal: MaternalCause[];
  child: ChildCause[];
}
