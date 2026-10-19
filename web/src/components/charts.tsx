import type { ApexAxisChartSeries, ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import {
  classify,
  formatCount,
  formatRate,
  shortCause,
  titleCase,
  type Signal,
} from "../lib/format";
import type { RegionRow, SexRow } from "../types";

const SIGNAL_COLOR: Record<Signal, string> = {
  higher: "#e11d48",
  similar: "#94a3b8",
  lower: "#059669",
};

const GRID = "#e2e8f0";
const AXIS_TEXT = "#475569";

function barBase(height: number): ApexOptions {
  return {
    chart: {
      type: "bar",
      height,
      fontFamily: "inherit",
      toolbar: { show: false },
      animations: { enabled: true, speed: 350 },
    },
    grid: {
      borderColor: GRID,
      yaxis: { lines: { show: false } },
      xaxis: { lines: { show: true } },
      padding: { left: 4, right: 20, top: 0, bottom: 0 },
    },
    legend: { show: false },
  };
}

export function SignalLegend() {
  const items: { signal: Signal; label: string }[] = [
    { signal: "higher", label: "Interval di atas kabupaten" },
    { signal: "similar", label: "Interval mencakup kabupaten" },
    { signal: "lower", label: "Interval di bawah kabupaten" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.signal} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: SIGNAL_COLOR[item.signal] }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

interface AkbBarProps {
  rows: RegionRow[];
  reference: number | null;
}

export function AkbBarChart({ rows, reference }: AkbBarProps) {
  const sorted = [...rows].sort(
    (a, b) => (b.akbPer1000 ?? 0) - (a.akbPer1000 ?? 0),
  );
  const height = Math.max(360, sorted.length * 28 + 40);
  const max = Math.max(
    ...sorted.map((row) => row.akbCi95High ?? 0),
    reference ?? 0,
    1,
  );

  const series: ApexAxisChartSeries = [
    {
      name: "AKB",
      data: sorted.map((row) => row.akbPer1000 ?? 0),
    },
  ];

  const options: ApexOptions = {
    ...barBase(height),
    colors: sorted.map(
      (row) =>
        SIGNAL_COLOR[
          classify(row.akbCi95Low, row.akbCi95High, reference) ?? "similar"
        ],
    ),
    plotOptions: {
      bar: {
        horizontal: true,
        distributed: true,
        barHeight: "58%",
        borderRadius: 3,
      },
    },
    dataLabels: {
      enabled: true,
      offsetX: 10,
      formatter: (value) => formatRate(Number(value)),
      style: { fontSize: "10px", colors: ["#334155"] },
      background: { enabled: false },
    },
    xaxis: {
      categories: sorted.map((row) => titleCase(row.regionName)),
      max: Math.ceil(max * 1.22),
      labels: {
        formatter: (value) => formatCount(Number(value)),
        style: { fontSize: "10px", colors: AXIS_TEXT },
      },
      axisTicks: { show: false },
      axisBorder: { show: false },
    },
    yaxis: {
      labels: { style: { fontSize: "11px", colors: AXIS_TEXT } },
    },
    tooltip: {
      y: { formatter: (value) => `${formatRate(Number(value))} per 1.000 KH` },
    },
  };

  return <Chart type="bar" height={height} series={series} options={options} />;
}

interface SexBarProps {
  rows: SexRow[];
}

export function SexBarChart({ rows }: SexBarProps) {
  const ordered = [...rows].sort((a) => (a.sex === "M" ? -1 : 1));
  const height = 150;

  const series: ApexAxisChartSeries = [
    {
      name: "AKB",
      data: ordered.map((row) => row.akbPer1000 ?? 0),
    },
  ];

  const options: ApexOptions = {
    ...barBase(height),
    colors: ["#0369a1", "#be185d"],
    plotOptions: {
      bar: { horizontal: true, distributed: true, barHeight: "46%", borderRadius: 4 },
    },
    dataLabels: {
      enabled: true,
      offsetX: 10,
      formatter: (value) => formatRate(Number(value)),
      style: { fontSize: "11px", colors: ["#334155"] },
      background: { enabled: false },
    },
    xaxis: {
      categories: ordered.map((row) => (row.sex === "M" ? "Laki-laki" : "Perempuan")),
      labels: { show: false },
      axisTicks: { show: false },
      axisBorder: { show: false },
    },
    yaxis: { labels: { style: { fontSize: "11px", colors: AXIS_TEXT } } },
    grid: { show: false, padding: { left: 0, right: 28, top: 0, bottom: 0 } },
    tooltip: {
      y: { formatter: (value) => `${formatRate(Number(value))} per 1.000 KH` },
    },
  };

  return <Chart type="bar" height={height} series={series} options={options} />;
}

export interface CauseDatum {
  name: string;
  deaths: number;
  share: number | null;
}

interface CauseBarProps {
  data: CauseDatum[];
  color: string;
  height?: number;
}

export function CauseBarChart({ data, color, height }: CauseBarProps) {
  const sorted = [...data].sort((a, b) => b.deaths - a.deaths);
  const chartHeight = height ?? Math.max(150, sorted.length * 34 + 30);

  const series: ApexAxisChartSeries = [
    { name: "Kematian", data: sorted.map((row) => row.deaths) },
  ];

  const options: ApexOptions = {
    ...barBase(chartHeight),
    colors: [color],
    plotOptions: {
      bar: { horizontal: true, barHeight: "56%", borderRadius: 3 },
    },
    dataLabels: {
      enabled: true,
      offsetX: 8,
      formatter: (value) => formatCount(Number(value)),
      style: { fontSize: "10px", colors: ["#334155"] },
      background: { enabled: false },
    },
    xaxis: {
      categories: sorted.map((row) => shortCause(row.name)),
      max: Math.max(...sorted.map((row) => row.deaths), 1) * 1.18,
      labels: { show: false },
      axisTicks: { show: false },
      axisBorder: { show: false },
    },
    yaxis: {
      labels: { style: { fontSize: "11px", colors: AXIS_TEXT } },
    },
    grid: { show: false, padding: { left: 0, right: 24, top: 0, bottom: 0 } },
    tooltip: {
      y: { formatter: (value) => `${formatCount(Number(value))} kematian` },
    },
  };

  return (
    <Chart type="bar" height={chartHeight} series={series} options={options} />
  );
}
