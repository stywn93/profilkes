import type { ReactNode } from "react";

interface TableCardProps {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function TableCard({ title, subtitle, footer, children }: TableCardProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        ) : null}
      </header>
      {children}
      {footer ? (
        <div className="border-t border-slate-100 px-5 py-3 text-xs leading-relaxed text-slate-500">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  note?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  subtitle,
  note,
  footer,
  children,
  className = "",
}: ChartCardProps) {
  return (
    <section
      className={`flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        {note ? <div className="text-xs text-slate-500">{note}</div> : null}
      </header>
      <div className="flex-1 px-3 py-4 sm:px-5">{children}</div>
      {footer ? (
        <div className="border-t border-slate-100 px-5 py-3 text-xs leading-relaxed text-slate-500">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
