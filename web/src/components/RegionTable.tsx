import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from "flowbite-react";
import { useMemo, useState } from "react";
import {
  classify,
  confidenceInterval,
  formatCount,
  formatRate,
  SIGNAL_LABEL,
  titleCase,
  type Signal,
} from "../lib/format";
import type { RegionRow } from "../types";

type SortKey = "name" | "liveBirths" | "maternalDeaths" | "aki" | "infantDeaths" | "akb";

const BADGE_COLOR: Record<Signal, "failure" | "gray" | "success"> = {
  higher: "failure",
  similar: "gray",
  lower: "success",
};

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Wilayah" },
  { key: "liveBirths", label: "Lahir hidup", numeric: true },
  { key: "maternalDeaths", label: "Kematian ibu", numeric: true },
  { key: "aki", label: "AKI / 100.000 KH", numeric: true },
  { key: "infantDeaths", label: "Kematian bayi", numeric: true },
  { key: "akb", label: "AKB / 1.000 KH", numeric: true },
];

function valueFor(row: RegionRow, key: SortKey): number | string {
  switch (key) {
    case "name":
      return row.regionName;
    case "liveBirths":
      return row.liveBirths;
    case "maternalDeaths":
      return row.maternalDeaths;
    case "aki":
      return row.akiPer100k ?? -1;
    case "infantDeaths":
      return row.infantDeaths;
    case "akb":
      return row.akbPer1000 ?? -1;
  }
}

interface RegionTableProps {
  rows: RegionRow[];
  reference: number | null;
  caption: string;
}

export function RegionTable({ rows, reference, caption }: RegionTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("akb");
  const [descending, setDescending] = useState(true);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const left = valueFor(a, sortKey);
      const right = valueFor(b, sortKey);
      const comparison =
        typeof left === "string" && typeof right === "string"
          ? left.localeCompare(right, "id")
          : Number(left) - Number(right);
      return descending ? -comparison : comparison;
    });
    return copy;
  }, [rows, sortKey, descending]);

  function toggle(key: SortKey) {
    if (key === sortKey) {
      setDescending((value) => !value);
    } else {
      setSortKey(key);
      setDescending(key !== "name");
    }
  }

  return (
    <div className="overflow-x-auto">
      <Table striped className="text-xs">
        <caption className="sr-only">{caption}</caption>
        <TableHead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <TableRow>
            {COLUMNS.map((column) => (
              <TableHeadCell
                key={column.key}
                scope="col"
                className={column.numeric ? "text-right" : ""}
              >
                <button
                  type="button"
                  onClick={() => toggle(column.key)}
                  className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-slate-800 ${
                    column.numeric ? "justify-end" : ""
                  }`}
                  aria-label={`Urutkan menurut ${column.label}`}
                >
                  {column.label}
                  <span className="text-[9px] text-slate-400" aria-hidden>
                    {sortKey === column.key ? (descending ? "▼" : "▲") : "↕"}
                  </span>
                </button>
              </TableHeadCell>
            ))}
            <TableHeadCell scope="col" className="text-right">
              Sinyal AKB
            </TableHeadCell>
          </TableRow>
        </TableHead>
        <TableBody className="divide-y divide-slate-100">
          {sorted.map((row) => {
            const signal = classify(row.akbCi95Low, row.akbCi95High, reference);
            return (
              <TableRow key={row.regionId} className="bg-white">
                <TableCell className="whitespace-nowrap font-medium text-slate-800">
                  {titleCase(row.regionName)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCount(row.liveBirths)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCount(row.maternalDeaths)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="block font-medium text-slate-900">
                    {formatRate(row.akiPer100k)}
                  </span>
                  <span className="block text-[10px] text-slate-400">
                    {confidenceInterval(row.akiCi95Low, row.akiCi95High)}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCount(row.infantDeaths)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="block font-medium text-slate-900">
                    {formatRate(row.akbPer1000)}
                  </span>
                  <span className="block text-[10px] text-slate-400">
                    {confidenceInterval(row.akbCi95Low, row.akbCi95High)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {signal ? (
                    <Badge color={BADGE_COLOR[signal]} className="inline-flex whitespace-nowrap">
                      {SIGNAL_LABEL[signal]}
                    </Badge>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
