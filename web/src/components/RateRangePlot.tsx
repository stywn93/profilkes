import { formatRate, titleCase } from "../lib/format";

export interface RangeRow {
  name: string;
  value: number | null;
  low: number | null;
  high: number | null;
  deaths: number;
}

interface RateRangePlotProps {
  rows: RangeRow[];
  reference: number | null;
  referenceLabel: string;
  unit: string;
}

/**
 * Point estimate with its 95% interval. A plain bar would imply that a
 * kecamatan with one death has a rate five times the district's; the interval
 * makes the uncertainty the dominant visual.
 */
export function RateRangePlot({
  rows,
  reference,
  referenceLabel,
  unit,
}: RateRangePlotProps) {
  const sorted = [...rows].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const maxHigh = Math.max(
    ...sorted.map((row) => row.high ?? 0),
    reference ?? 0,
    1,
  );
  const domain = Math.ceil((maxHigh * 1.05) / 100) * 100;
  const toPercent = (value: number) =>
    Math.min(100, Math.max(0, (value / domain) * 100));

  const ticks = [0, domain / 2, domain];

  return (
    <div>
      {reference !== null ? (
        <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-500">
          <span className="inline-block h-3 w-0 border-l border-dashed border-sky-500" />
          {referenceLabel} {formatRate(reference)} {unit}
        </div>
      ) : null}

      <div className="relative">
        {/* Spans exactly the track column: 96px label + 8px gap on the left,
            64px value + 8px gap on the right. */}
        {reference !== null ? (
          <div
            className="pointer-events-none absolute inset-y-0 z-0"
            style={{ left: 104, right: 72 }}
            aria-hidden
          >
            <div
              className="absolute inset-y-0 border-l border-dashed border-sky-400/70"
              style={{ left: `${toPercent(reference)}%` }}
            />
          </div>
        ) : null}

        <div className="relative z-10 space-y-0.5">
          {sorted.map((row) => {
            const low = row.low ?? 0;
            const high = row.high ?? 0;
            const width = Math.max(toPercent(high) - toPercent(low), 0.6);
            const dot = toPercent(row.value ?? 0);
            return (
              <div
                key={row.name}
                className="grid grid-cols-[96px_1fr_64px] items-center gap-2 rounded-md py-0.5 hover:bg-slate-50"
                title={`${titleCase(row.name)}: ${formatRate(row.value)} ${unit} (95% CI ${formatRate(low)}–${formatRate(high)}), ${row.deaths} kematian`}
              >
                <span className="truncate text-[11px] font-medium text-slate-600">
                  {titleCase(row.name)}
                </span>
                <span className="relative block h-6">
                  <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-100" />
                  <span
                    className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-sky-200"
                    style={{
                      left: `${toPercent(low)}%`,
                      width: `${width}%`,
                    }}
                  />
                  <span
                    className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sky-700 shadow-sm"
                    style={{ left: `${dot}%` }}
                  />
                </span>
                <span className="text-right text-[11px] tabular-nums text-slate-700">
                  {formatRate(row.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[96px_1fr_64px] gap-2 text-[10px] text-slate-400">
        <span />
        <span className="flex justify-between tabular-nums">
          {ticks.map((tick) => (
            <span key={tick}>{Math.round(tick)}</span>
          ))}
        </span>
        <span className="text-right">{unit}</span>
      </div>
    </div>
  );
}
