-- =====================================================================
-- Convenience layer: the same objects, reachable without a schema prefix.
--
-- Every table and view of the pilot lives in a schema of its own
-- (dim, etl, fact, mart) so the layering stays visible. That is fine for
-- the API, but a lot of tools - database GUIs, spreadsheet connectors, BI
-- tools - list the `public` schema and nothing else, which makes the
-- database look empty.
--
-- These views are plain aliases: they store nothing, so a number cannot
-- drift from the mart it comes from. Dropping a schema cascades to them.
--
--   public.v_kpi_summary  ... the headline figures of the dashboard
--   public.v_aki          ... AKI per region, with the 95% interval
--   public.v_akb          ... AKB per region, with the 95% interval
--   public.v_fact_*       ... the raw counts, one row per puskesmas
-- =====================================================================

CREATE OR REPLACE VIEW public.v_kpi_summary AS
    SELECT * FROM mart.kpi_summary;

CREATE OR REPLACE VIEW public.v_aki AS
    SELECT * FROM mart.aki;

CREATE OR REPLACE VIEW public.v_akb AS
    SELECT * FROM mart.akb;

CREATE OR REPLACE VIEW public.v_akb_by_sex AS
    SELECT * FROM mart.akb_by_sex;

CREATE OR REPLACE VIEW public.v_maternal_death_cause AS
    SELECT * FROM mart.maternal_death_cause;

CREATE OR REPLACE VIEW public.v_child_death_cause AS
    SELECT * FROM mart.child_death_cause;

CREATE OR REPLACE VIEW public.v_live_births_by_region AS
    SELECT * FROM mart.live_births_by_region;

CREATE OR REPLACE VIEW public.v_regions AS
    SELECT * FROM dim.dim_region;

-- One flat row per region: both rates, both intervals, the counts behind
-- them. This is the table to open when browsing by hand.
CREATE OR REPLACE VIEW public.v_region_aki_akb AS
SELECT a.region_id,
       a.level,
       a.region_name,
       a.year,
       a.live_births,
       a.maternal_deaths,
       a.aki_per_100k,
       a.aki_ci95_low,
       a.aki_ci95_high,
       b.neonatal_deaths,
       b.post_neonatal_deaths,
       b.infant_deaths,
       b.child_1_4_deaths,
       b.under5_deaths,
       b.akn_per_1000,
       b.akb_per_1000,
       b.akbalita_per_1000,
       b.akb_ci95_low,
       b.akb_ci95_high
  FROM mart.aki a
  JOIN mart.akb b USING (region_id, period_id);

CREATE OR REPLACE VIEW public.v_causes AS
    SELECT * FROM dim.dim_cause;

CREATE OR REPLACE VIEW public.v_import_batches AS
    SELECT * FROM etl.import_batch;

CREATE OR REPLACE VIEW public.v_fact_birth AS
    SELECT * FROM fact.fact_birth;

CREATE OR REPLACE VIEW public.v_fact_maternal_death AS
    SELECT * FROM fact.fact_maternal_death;

CREATE OR REPLACE VIEW public.v_fact_maternal_death_cause AS
    SELECT * FROM fact.fact_maternal_death_cause;

CREATE OR REPLACE VIEW public.v_fact_child_death AS
    SELECT * FROM fact.fact_child_death;

CREATE OR REPLACE VIEW public.v_fact_child_death_cause AS
    SELECT * FROM fact.fact_child_death_cause;

COMMENT ON VIEW public.v_kpi_summary IS 'Headline AKI/AKB figures of the dashboard, one row per district and year';
COMMENT ON VIEW public.v_aki IS 'Maternal mortality per 100.000 live births, per region, with a Wilson 95% interval';
COMMENT ON VIEW public.v_akb IS 'Infant mortality per 1.000 live births, per region, with a Wilson 95% interval';
COMMENT ON VIEW public.v_region_aki_akb IS 'One row per region: AKI and AKB with their intervals and the counts behind them';
COMMENT ON VIEW public.v_fact_birth IS 'Raw counts of table 21: live and still births per puskesmas, year and sex';

-- ---------------------------------------------------------------------
-- Read-only
--
-- A PostgreSQL view that selects from a single table is automatically
-- updatable, so `UPDATE public.v_fact_birth ...` would reach straight into
-- fact.fact_birth. An accidental edit in a database GUI would then change a
-- number that the dashboard publishes, with nothing to detect it: the
-- invariants still hold, because the edit is internally consistent.
--
-- These views exist to be read. Block every write on them explicitly, so
-- the counts can only ever change through the loader, which reconciles
-- them against the workbook.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deny_write() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION
        '% is read-only. The counts are changed by the loader, which reconciles them against the workbook.',
        TG_TABLE_NAME
        USING ERRCODE = 'read_only_sql_transaction';
END;
$$;

DO $$
DECLARE
    view_name text;
BEGIN
    FOR view_name IN
        SELECT c.relname
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relkind = 'v'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_deny_write ON public.%I', view_name);
        EXECUTE format(
            'CREATE TRIGGER trg_deny_write INSTEAD OF INSERT OR UPDATE OR DELETE ON public.%I '
            'FOR EACH ROW EXECUTE FUNCTION public.deny_write()', view_name);
    END LOOP;
END
$$;

