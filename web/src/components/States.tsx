import { Alert, Spinner } from "flowbite-react";

export function LoadingBlock({ label = "Memuat data…" }: { label?: string }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-sm text-slate-500">
      <Spinner size="xl" aria-label={label} />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <Alert color="failure" className="my-4">
      <p className="font-medium">Data gagal dimuat</p>
      <p className="mt-1 text-sm">{message}</p>
      <p className="mt-2 text-xs">
        Pastikan API berjalan (<code>npm run dev</code> di folder <code>server</code>)
        dan database sudah dimuat.
      </p>
    </Alert>
  );
}
