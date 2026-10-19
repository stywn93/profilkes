import { lazy, Suspense, useEffect, useState } from "react";
import { Shell } from "./components/Shell";
import { ErrorBlock, LoadingBlock } from "./components/States";
import { isPageKey, PAGES, type PageKey } from "./lib/pages";
import { useApi } from "./lib/useApi";
import type { Meta } from "./types";

// Each page is loaded on demand so ApexCharts only ships with the pages that
// draw charts, keeping the first paint small.
const OverviewPage = lazy(() =>
  import("./pages/Overview").then((module) => ({ default: module.OverviewPage })),
);
const AkiPage = lazy(() =>
  import("./pages/Aki").then((module) => ({ default: module.AkiPage })),
);
const AkbPage = lazy(() =>
  import("./pages/Akb").then((module) => ({ default: module.AkbPage })),
);
const CausesPage = lazy(() =>
  import("./pages/Causes").then((module) => ({ default: module.CausesPage })),
);
const DataQualityPage = lazy(() =>
  import("./pages/DataQuality").then((module) => ({ default: module.DataQualityPage })),
);

function pageFromHash(): PageKey {
  const hash = window.location.hash.replace("#", "");
  return isPageKey(hash) ? hash : "ringkasan";
}

export default function App() {
  const meta = useApi<Meta>("/api/meta");
  const [page, setPage] = useState<PageKey>(pageFromHash);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Keep the page in the URL hash so a view can be linked to directly.
  useEffect(() => {
    if (window.location.hash !== `#${page}`) {
      window.history.replaceState(null, "", `#${page}`);
    }
  }, [page]);

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const years = meta.data?.years ?? [];
  const year = selectedYear ?? years[0] ?? null;

  if (meta.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingBlock label="Memuat konfigurasi data…" />
      </div>
    );
  }

  if (meta.error || !meta.data) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-lg font-semibold text-slate-900">
          {PAGES.ringkasan.title}
        </h1>
        <ErrorBlock message={meta.error ?? "Metadata tidak tersedia"} />
      </div>
    );
  }

  if (year === null) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-sm text-slate-600">
        Belum ada periode yang dimuat. Jalankan loader untuk mengisi database.
      </div>
    );
  }

  return (
    <Shell
      page={page}
      onNavigate={setPage}
      years={years}
      year={year}
      onYearChange={setSelectedYear}
      district={meta.data.district}
      province={meta.data.province}
      loadedAt={meta.data.batch?.loadedAt ?? null}
    >
      <Suspense fallback={<LoadingBlock label="Memuat halaman…" />}>
        {page === "ringkasan" ? <OverviewPage year={year} /> : null}
        {page === "aki" ? <AkiPage year={year} /> : null}
        {page === "akb" ? <AkbPage year={year} /> : null}
        {page === "penyebab" ? <CausesPage year={year} /> : null}
        {page === "data" ? <DataQualityPage /> : null}
      </Suspense>
    </Shell>
  );
}
