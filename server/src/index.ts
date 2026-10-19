import Fastify, { type FastifyError } from "fastify";
import { pool, query } from "./db.js";

const LEVELS = ["subdistrict", "health_center", "district"] as const;
type Level = (typeof LEVELS)[number];

const app = Fastify({ logger: { level: "info" } });

function httpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

interface YearQuery {
  year?: string;
  level?: string;
}

async function resolveYear(raw?: string): Promise<number> {
  if (raw !== undefined) {
    const year = Number(raw);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      throw httpError(400, `Tahun tidak valid: ${raw}`);
    }
    return year;
  }
  const rows = await query<{ year: number }>(
    "SELECT year FROM dim.dim_period ORDER BY year DESC LIMIT 1",
  );
  const year = rows[0]?.year;
  if (!year) throw httpError(404, "Belum ada periode yang dimuat");
  return year;
}

function resolveLevel(raw?: string, fallback: Level = "subdistrict"): Level {
  if (raw === undefined) return fallback;
  if ((LEVELS as readonly string[]).includes(raw)) return raw as Level;
  throw httpError(400, `Level tidak dikenal: ${raw}`);
}

app.addHook("onSend", async (_request, reply) => {
  reply.header("Cache-Control", "no-store");
});

app.get("/api/health", async (_request, reply) => {
  try {
    await query("SELECT 1");
    return { ok: true, database: "up" };
  } catch (error) {
    app.log.error(error);
    return reply.code(503).send({ ok: false, database: "down" });
  }
});

app.get("/api/meta", async () => {
  const [years, batches, levels, names] = await Promise.all([
    query<{ year: number }>("SELECT year FROM dim.dim_period ORDER BY year DESC"),
    query<{
      sourceFile: string;
      loadedAt: string;
      sha256: string;
      district: string | null;
      sourceYear: number | null;
    }>(
      `SELECT source_file AS "sourceFile",
              loaded_at   AS "loadedAt",
              file_sha256 AS "sha256",
              district,
              source_year AS "sourceYear"
         FROM etl.import_batch
        ORDER BY batch_id DESC
        LIMIT 1`,
    ),
    query<{ level: string; count: number }>(
      `SELECT level, count(*)::int AS count FROM dim.dim_region GROUP BY level ORDER BY level`,
    ),
    query<{ level: string; name: string }>(
      `SELECT level, name FROM dim.dim_region WHERE level IN ('province', 'district')`,
    ),
  ]);

  return {
    years: years.map((row) => row.year),
    batch: batches[0] ?? null,
    levels: Object.fromEntries(levels.map((row) => [row.level, row.count])),
    province: names.find((row) => row.level === "province")?.name ?? null,
    district: names.find((row) => row.level === "district")?.name ?? null,
  };
});

app.get<{ Querystring: YearQuery }>("/api/overview", async (request) => {
  const year = await resolveYear(request.query.year);

  const [kpiRows, sexRows, births] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT region_name        AS "regionName",
              year,
              live_births        AS "liveBirths",
              maternal_deaths    AS "maternalDeaths",
              aki_per_100k       AS "akiPer100k",
              aki_ci95_low       AS "akiCi95Low",
              aki_ci95_high      AS "akiCi95High",
              neonatal_deaths    AS "neonatalDeaths",
              infant_deaths      AS "infantDeaths",
              under5_deaths      AS "under5Deaths",
              akn_per_1000       AS "aknPer1000",
              akb_per_1000       AS "akbPer1000",
              akbalita_per_1000  AS "akbalitaPer1000",
              akb_ci95_low       AS "akbCi95Low",
              akb_ci95_high      AS "akbCi95High"
         FROM mart.kpi_summary
        WHERE year = $1`,
      [year],
    ),
    query<Record<string, unknown>>(
      `SELECT sex,
              live_births    AS "liveBirths",
              infant_deaths  AS "infantDeaths",
              akb_per_1000   AS "akbPer1000"
         FROM mart.akb_by_sex
        WHERE year = $1 AND level = 'district'
        ORDER BY sex`,
      [year],
    ),
    query<{ liveBirths: number; stillbirths: number; stillbirthsPer1000: number }>(
      // Stillbirth rate uses total births (live + still) as the denominator,
      // the same convention as the workbook's "Angka Lahir Mati".
      `SELECT b.live_births AS "liveBirths",
              b.stillbirths,
              round(b.stillbirths * 1000.0 / NULLIF(b.live_births + b.stillbirths, 0), 2)
                AS "stillbirthsPer1000"
         FROM mart.live_births_by_region b
         JOIN dim.dim_period p ON p.period_id = b.period_id
         JOIN dim.dim_region r ON r.region_id = b.region_id
        WHERE p.year = $1 AND r.level = 'district'`,
      [year],
    ),
  ]);

  const kpi = kpiRows[0];
  if (!kpi) throw httpError(404, `Tidak ada data untuk tahun ${year}`);

  return { kpi, sex: sexRows, stillbirths: births[0] ?? null };
});

app.get<{ Querystring: YearQuery }>("/api/regions", async (request) => {
  const year = await resolveYear(request.query.year);
  const level = resolveLevel(request.query.level);

  const rows = await query<Record<string, unknown>>(
    `SELECT k.region_id          AS "regionId",
            k.region_name        AS "regionName",
            k.level,
            k.live_births        AS "liveBirths",
            a.maternal_deaths    AS "maternalDeaths",
            a.deaths_pregnant    AS "deathsPregnant",
            a.deaths_delivery    AS "deathsDelivery",
            a.deaths_postpartum  AS "deathsPostpartum",
            a.aki_per_100k       AS "akiPer100k",
            a.aki_ci95_low       AS "akiCi95Low",
            a.aki_ci95_high      AS "akiCi95High",
            k.neonatal_deaths    AS "neonatalDeaths",
            k.post_neonatal_deaths AS "postNeonatalDeaths",
            k.infant_deaths      AS "infantDeaths",
            k.child_1_4_deaths   AS "child14Deaths",
            k.under5_deaths      AS "under5Deaths",
            k.akn_per_1000       AS "aknPer1000",
            k.akb_per_1000       AS "akbPer1000",
            k.akbalita_per_1000  AS "akbalitaPer1000",
            k.akb_ci95_low       AS "akbCi95Low",
            k.akb_ci95_high      AS "akbCi95High"
       FROM mart.akb k
       JOIN mart.aki a ON a.region_id = k.region_id AND a.period_id = k.period_id
      WHERE k.year = $1 AND k.level = $2
      ORDER BY k.region_name`,
    [year, level],
  );

  return { year, level, rows };
});

app.get<{ Querystring: YearQuery }>("/api/causes", async (request) => {
  const year = await resolveYear(request.query.year);
  // Cause views are per region; default to the district row so totals and
  // shares are for the whole kabupaten rather than 17 stacked copies.
  const level = resolveLevel(request.query.level, "district");

  const [maternal, child] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT cause,
              deaths,
              share_percent AS "sharePercent",
              sort_order    AS "sortOrder"
         FROM mart.maternal_death_cause
        WHERE year = $1 AND level = $2
        ORDER BY sort_order`,
      [year, level],
    ),
    query<Record<string, unknown>>(
      `SELECT cause_group AS "causeGroup",
              cause,
              deaths,
              share_percent AS "sharePercent",
              sort_order AS "sortOrder"
         FROM mart.child_death_cause
        WHERE year = $1 AND level = $2
        ORDER BY cause_group, sort_order`,
      [year, level],
    ),
  ]);

  return { year, level, maternal, child };
});

app.setErrorHandler<FastifyError>((error, request, reply) => {
  const status = error.statusCode ?? 500;
  if (status >= 500) {
    request.log.error(error);
    return reply.code(503).send({
      error: "database_unavailable",
      message: "Tidak dapat membaca database. Pastikan Postgres berjalan dan data sudah dimuat.",
    });
  }
  return reply.code(status).send({ error: "bad_request", message: error.message });
});

const port = Number(process.env.PORT ?? 8787);

app
  .listen({ port, host: "127.0.0.1" })
  .then((address) => app.log.info(`API listening on ${address}`))
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
}
