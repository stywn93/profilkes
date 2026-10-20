-- Lists every table and view of the pilot with its real row count.
--   docker compose exec -T db psql -U postgres -d profilkes -f /scripts/tables.sql
DO $$
DECLARE
    query text;
BEGIN
    SELECT 'CREATE TEMP TABLE object_rows AS ' || string_agg(
               format('SELECT %L::text AS schema, %L::text AS object, %L::text AS kind, count(*) AS rows FROM %I.%I',
                      table_schema, table_name, table_type, table_schema, table_name),
               ' UNION ALL ' ORDER BY table_schema, table_type, table_name)
      INTO query
      FROM information_schema.tables
     WHERE table_schema IN ('dim', 'etl', 'fact', 'mart', 'public');
    EXECUTE query;
END
$$;

SELECT schema, object, kind, rows FROM object_rows ORDER BY schema, kind, object;
