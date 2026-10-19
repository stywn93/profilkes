import pg from "pg";

const { Pool, types } = pg;

// The marts expose rates as numeric; pg returns those as strings by default.
// Parse them as numbers so the API emits JSON numbers, not "110.84".
types.setTypeParser(types.builtins.NUMERIC, (value: string) => Number(value));
types.setTypeParser(types.builtins.INT8, (value: string) => Number(value));

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:55432/profilkes",
  max: 5,
});

export async function query<T extends pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}
