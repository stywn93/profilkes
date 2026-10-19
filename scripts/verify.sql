-- =====================================================================
-- Invariant checks for the AKI/AKB pilot database.
-- Dataset-agnostic: run after any load, from any workbook.
--   psql "$DATABASE_URL" -f scripts/verify.sql
-- Exits non-zero if any check fails.
-- =====================================================================
\set ON_ERROR_STOP on

DROP TABLE IF EXISTS qa_log;
CREATE TEMP TABLE qa_log (ok boolean, label text);

-- 1. Every puskesmas carries a complete fact set: 2 sexes, 3 phases, 6 age/sex cells.
INSERT INTO qa_log
SELECT NOT EXISTS (
           SELECT 1
           FROM dim.dim_region r
           WHERE r.level = 'health_center'
             AND (
                   (SELECT count(*) FROM fact.fact_birth b WHERE b.region_id = r.region_id) <> 2
                OR (SELECT count(*) FROM fact.fact_maternal_death m WHERE m.region_id = r.region_id) <> 3
                OR (SELECT count(*) FROM fact.fact_child_death c WHERE c.region_id = r.region_id) <> 6
             )
       ),
       'every puskesmas has 2 birth, 3 maternal-phase and 6 child-death rows';

-- 2. Facts are stored at puskesmas grain only, so rollups cannot double count.
INSERT INTO qa_log
SELECT NOT EXISTS (
           SELECT 1
           FROM dim.dim_region r
           WHERE r.level <> 'health_center'
             AND (
                   EXISTS (SELECT 1 FROM fact.fact_birth x WHERE x.region_id = r.region_id)
                OR EXISTS (SELECT 1 FROM fact.fact_maternal_death x WHERE x.region_id = r.region_id)
                OR EXISTS (SELECT 1 FROM fact.fact_child_death x WHERE x.region_id = r.region_id)
                OR EXISTS (SELECT 1 FROM fact.fact_maternal_death_cause x WHERE x.region_id = r.region_id)
                OR EXISTS (SELECT 1 FROM fact.fact_child_death_cause x WHERE x.region_id = r.region_id)
             )
       ),
       'facts reference puskesmas only (no pre-aggregated rows)';

-- 3. Kecamatan rollup reconciles with the district row.
INSERT INTO qa_log
SELECT ((SELECT sum(live_births) FROM mart.akb WHERE level = 'subdistrict')
          = (SELECT live_births FROM mart.akb WHERE level = 'district'))
       AND ((SELECT sum(infant_deaths) FROM mart.akb WHERE level = 'subdistrict')
          = (SELECT infant_deaths FROM mart.akb WHERE level = 'district'))
       AND ((SELECT sum(maternal_deaths) FROM mart.aki WHERE level = 'subdistrict')
          = (SELECT maternal_deaths FROM mart.aki WHERE level = 'district')),
       'kecamatan rollup equals the district figures';

-- 4. Neonatal + post-neonatal equals infant, and + 12-59 months equals under-5.
INSERT INTO qa_log
SELECT NOT EXISTS (SELECT 1 FROM mart.akb
                   WHERE under5_deaths <> neonatal_deaths + post_neonatal_deaths + child_1_4_deaths)
       AND NOT EXISTS (SELECT 1 FROM mart.akb
                       WHERE infant_deaths <> neonatal_deaths + post_neonatal_deaths),
       'age bands add up (infant, under-5)';

-- 5. Cause totals reconcile with the corresponding death totals.
INSERT INTO qa_log
SELECT ((SELECT sum(deaths) FROM fact.fact_maternal_death_cause)
          = (SELECT sum(deaths) FROM fact.fact_maternal_death))
       AND ((SELECT sum(d.deaths) FROM fact.fact_child_death_cause d
               JOIN dim.dim_cause c ON c.cause_id = d.cause_id
              WHERE c.cause_group = 'neonatal')
          = (SELECT sum(deaths) FROM fact.fact_child_death WHERE age_band = 'neonatal')),
       'cause tables reconcile with death totals';

-- 6. AKI is exactly the stored counts, at every level.
INSERT INTO qa_log
SELECT NOT EXISTS (
           SELECT 1 FROM mart.aki
           WHERE aki_per_100k IS DISTINCT FROM
                 round(maternal_deaths * 100000.0 / NULLIF(live_births, 0), 2)
       ),
       'AKI equals maternal deaths / live births x 100,000';

-- 7. AKB is exactly the stored counts, at every level.
INSERT INTO qa_log
SELECT NOT EXISTS (
           SELECT 1 FROM mart.akb
           WHERE akb_per_1000 IS DISTINCT FROM
                 round(infant_deaths * 1000.0 / NULLIF(live_births, 0), 2)
       ),
       'AKB equals infant deaths / live births x 1,000';

-- 8. Confidence intervals are ordered and bracket the point estimate.
INSERT INTO qa_log
SELECT NOT EXISTS (
           SELECT 1 FROM mart.aki
           WHERE aki_ci95_low > aki_ci95_high
              OR aki_ci95_low > aki_per_100k + 0.01
              OR aki_ci95_high < aki_per_100k - 0.01
       )
       AND NOT EXISTS (
           SELECT 1 FROM mart.akb
           WHERE akb_ci95_low > akb_ci95_high
              OR akb_ci95_low > akb_per_1000 + 0.01
              OR akb_ci95_high < akb_per_1000 - 0.01
       ),
       'confidence intervals bracket the point estimate';

-- 9. One row per region per period in every mart.
INSERT INTO qa_log
SELECT ((SELECT count(*) FROM mart.aki)
          = (SELECT count(DISTINCT (region_id, period_id)) FROM mart.aki))
       AND ((SELECT count(*) FROM mart.akb)
          = (SELECT count(DISTINCT (region_id, period_id)) FROM mart.akb))
       AND ((SELECT count(*) FROM mart.akb_by_sex)
          = (SELECT count(DISTINCT (region_id, period_id, sex)) FROM mart.akb_by_sex)),
       'marts have one row per region, period and grain';

-- 10. No negative counts.
INSERT INTO qa_log
SELECT NOT EXISTS (SELECT 1 FROM fact.fact_birth WHERE live_births < 0 OR stillbirths < 0)
       AND NOT EXISTS (SELECT 1 FROM fact.fact_maternal_death WHERE deaths < 0)
       AND NOT EXISTS (SELECT 1 FROM fact.fact_child_death WHERE deaths < 0)
       AND NOT EXISTS (SELECT 1 FROM fact.fact_maternal_death_cause WHERE deaths < 0)
       AND NOT EXISTS (SELECT 1 FROM fact.fact_child_death_cause WHERE deaths < 0),
       'no negative counts';

-- 11. Cause shares sum to 100 per region and period, within rounding.
INSERT INTO qa_log
SELECT NOT EXISTS (
           SELECT 1 FROM (
               SELECT region_id, period_id, sum(deaths) AS deaths, sum(share_percent) AS share
               FROM mart.maternal_death_cause
               GROUP BY 1, 2
           ) q
           WHERE deaths > 0 AND abs(share - 100) > 0.5
       ),
       'maternal cause shares sum to 100 percent';

-- 12. Sex split of live births equals the all-sex total.
INSERT INTO qa_log
SELECT NOT EXISTS (
           SELECT 1 FROM mart.live_births_by_region lb
           WHERE lb.live_births <> (
               SELECT sum(s.live_births) FROM mart.akb_by_sex s
               WHERE s.region_id = lb.region_id AND s.period_id = lb.period_id
           )
       ),
       'sex split of live births equals the total';

SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS status, label FROM qa_log ORDER BY label;

DO $$
DECLARE
    failing text;
BEGIN
    SELECT string_agg(label, E'\n  - ') INTO failing FROM qa_log WHERE NOT ok;
    IF failing IS NOT NULL THEN
        RAISE EXCEPTION E'Data invariants violated:\n  - %', failing;
    END IF;
    RAISE NOTICE 'All % invariants hold.', (SELECT count(*) FROM qa_log);
END $$;
