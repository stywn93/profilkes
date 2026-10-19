import { Badge, Card } from "flowbite-react";
import { SIGNAL_LABEL, type Signal } from "../lib/format";

const TONE: Record<Signal, "failure" | "success" | "gray"> = {
  higher: "failure",
  similar: "gray",
  lower: "success",
};

interface KpiCardProps {
  label: string;
  value: string;
  unit: string;
  ci?: string;
  note: string;
  signal?: Signal | null;
  emphasis?: "default" | "muted";
}

export function KpiCard({
  label,
  value,
  unit,
  ci,
  note,
  signal,
  emphasis = "default",
}: KpiCardProps) {
  return (
    <Card className="h-full border border-slate-200 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        {signal ? (
          <Badge color={TONE[signal]} className="shrink-0">
            {SIGNAL_LABEL[signal]}
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={`text-[30px] font-semibold leading-none tracking-tight tabular-nums sm:text-[32px] ${
            emphasis === "muted" ? "text-slate-700" : "text-slate-900"
          }`}
        >
          {value}
        </span>
        <span className="text-xs text-slate-500">{unit}</span>
      </div>

      {ci ? (
        <p className="mt-2 text-xs tabular-nums text-slate-500">CI 95%: {ci}</p>
      ) : null}

      <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600">
        {note}
      </p>
    </Card>
  );
}
