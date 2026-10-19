import {
  Badge,
  Select,
  Sidebar,
  SidebarItem,
  SidebarItemGroup,
} from "flowbite-react";
import { useState, type ReactNode } from "react";
import { formatDate } from "../lib/format";
import { PAGES, type PageKey } from "../lib/pages";
import { IconBaby, IconCause, IconClose, IconData, IconMenu, IconMother, IconOverview } from "./icons";

const NAV: { key: PageKey; label: string; icon: typeof IconOverview }[] = [
  { key: "ringkasan", label: "Ringkasan", icon: IconOverview },
  { key: "aki", label: "Kematian ibu", icon: IconMother },
  { key: "akb", label: "Kematian bayi", icon: IconBaby },
  { key: "penyebab", label: "Penyebab", icon: IconCause },
  { key: "data", label: "Data & mutu", icon: IconData },
];

interface ShellProps {
  page: PageKey;
  onNavigate: (page: PageKey) => void;
  years: number[];
  year: number;
  onYearChange: (year: number) => void;
  district: string | null;
  province: string | null;
  loadedAt: string | null;
  children: ReactNode;
}

export function Shell({
  page,
  onNavigate,
  years,
  year,
  onYearChange,
  district,
  province,
  loadedAt,
  children,
}: ShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const meta = PAGES[page];

  function go(next: PageKey) {
    onNavigate(next);
    setMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {menuOpen ? (
        <button
          type="button"
          aria-label="Tutup navigasi"
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform md:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-5 py-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-700 text-sm font-bold text-white">
                PK
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight text-slate-900">
                  Profil Kesehatan
                </p>
                <p className="text-[11px] text-slate-500">
                  {district ? district : "Kabupaten"} · {year}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 md:hidden"
            onClick={() => setMenuOpen(false)}
            aria-label="Tutup menu"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          <Sidebar aria-label="Navigasi utama" className="bg-white [&>div]:bg-white">
            <SidebarItemGroup>
              {NAV.map((item) => (
                <SidebarItem
                  key={item.key}
                  href={`#${item.key}`}
                  icon={item.icon}
                  active={page === item.key}
                  onClick={(event) => {
                    event.preventDefault();
                    go(item.key);
                  }}
                >
                  {item.label}
                </SidebarItem>
              ))}
            </SidebarItemGroup>
          </Sidebar>
        </div>

        <div className="border-t border-slate-100 px-5 py-4 text-[11px] leading-relaxed text-slate-500">
          <p className="font-medium text-slate-600">Sumber data</p>
          <p className="mt-1">Profil Kesehatan 2025 (tabel 21, 23, 25, 34, 36, 37)</p>
          {province ? <p className="mt-1">{province}</p> : null}
          <p className="mt-2">Dimuat {formatDate(loadedAt)}</p>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
                onClick={() => setMenuOpen(true)}
                aria-label="Buka menu"
              >
                <IconMenu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold text-slate-900 sm:text-base">
                  {meta.title}
                </h1>
                <p className="truncate text-[11px] text-slate-500 sm:text-xs">
                  {meta.subtitle}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Badge color="info" className="hidden sm:inline-flex">
                Profil Kesehatan
              </Badge>
              <Select
                sizing="sm"
                aria-label="Pilih tahun"
                value={year}
                onChange={(event) => onYearChange(Number(event.target.value))}
                className="w-24"
              >
                {years.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
