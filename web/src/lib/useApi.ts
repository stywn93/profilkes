import { useEffect, useState } from "react";

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

interface Result<T> {
  path: string | null;
  data: T | null;
  error: string | null;
}

/**
 * Fetch a JSON endpoint and re-fetch when the path changes.
 *
 * `loading` is derived from whether the stored result belongs to the current
 * path, so the effect only writes the response instead of setting state
 * synchronously on every render.
 */
export function useApi<T>(path: string): ApiState<T> {
  const [result, setResult] = useState<Result<T>>({
    path: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    fetch(path, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        if (!response.ok) {
          throw new Error(body?.message ?? `Permintaan gagal (${response.status})`);
        }
        return body as T;
      })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ path, data, error: null });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (controller.signal.aborted) return;
        setResult({
          path,
          data: null,
          error: error instanceof Error ? error.message : "Gagal memuat data",
        });
      });

    return () => controller.abort();
  }, [path]);

  const loading = result.path !== path;

  return {
    data: loading ? null : result.data,
    error: loading ? null : result.error,
    loading,
  };
}
