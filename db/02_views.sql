-- =====================================================================
-- Dashboard marts for the AKI / AKB pilot.
--
-- Design rule: facts hold counts at puskesmas grain; everything else is
-- derived here. Rates always come from counts + live births so a rate can
-- never disagree with its numerator/denominator.
--
-- Rates on small denominators are unstable (e.g. 1 death in 346 births is
-- "289 per 100,000"). Each rate carries a Wilson 95% confidence interval
-- instead of an arbitrary reliability cut-off: the dashboard can show the
-- interval, grey out overlap, or sort by lower bound.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Region rollup helper: (descendant, ancestor, depth) for every pair.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW dim.region_ancestry AS
WITH RECURSIVE tree AS (
    SELECT r.region_id AS descendant_id,
           r.region_id AS ancestor_id,
           0           AS depth
    FROM dim.dim_region r
    UNION ALL
    SELECT t.descendant_id,
           p.region_id,   -- the parent of the current ancestor
           t.depth + 1
    FROM tree t
    JOIN dim.dim_region c ON c.region_id = t.ancestor_id
    JOIN dim.dim_region p ON p.region_id = c.parent_id
)
SELECT descendant_id, ancestor_id, depth
FROM tree;

COMMENT ON VIEW dim.region_ancestry IS
    'Every region mapped to itself and all of its ancestors, so a puskesmas fact can be summed at subdistrict, district or province level without double counting.';

-- ---------------------------------------------------------------------
-- Wilson score interval for a proportion; n = 0 yields NULL bounds.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mart.wilson_ci(k bigint, n bigint, z numeric DEFAULT 1.96)
RETURNS TABLE (lo numeric, hi numeric)
LANGUAGE sql IMMUTABLE AS $$
    SELECT
        CASE WHEN n = 0 THEN NULL ELSE (
            (k::numeric / n + z * z / (2 * n)
             - z * sqrt((k::numeric / n) * (1 - k::numeric / n) / n + z * z / (4 * n * n)))
            / (1 + z * z / n)
        ) END,
        CASE WHEN n = 0 THEN NULL ELSE (
            (k::numeric / n + z * z / (2 * n)
             + z * sqrt((k::numeric / n) * (1 - k::numeric / n) / n + z * z / (4 * n * n)))
            / (1 + z * z / n)
        ) END
$$;

COMMENT ON FUNCTION mart.wilson_ci IS
    'Wilson score 95% interval for k successes in n trials. Used to show how wide a mortality rate is when the denominator is small.';

-- ---------------------------------------------------------------------
-- Rolled-up denominators and numerators
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW mart.live_births_by_region AS
SELECT a.ancestor_id                AS region_id,
       b.period_id,
       SUM(b.live_births)::integer  AS live_births,
       SUM(b.stillbirths)::integer  AS stillbirths
FROM fact.fact_birth b
JOIN dim.region_ancestry a ON a.descendant_id = b.region_id
GROUP BY a.ancestor_id, b.period_id;

COMMENT ON VIEW mart.live_births_by_region IS
    'Live births and stillbirths summed at every region level. Shared denominator for AKI, AKB, AKN and stillbirth rate.';

CREATE OR REPLACE VIEW mart.maternal_deaths_by_region AS
SELECT a.ancestor_id AS region_id,
       d.period_id,
       COALESCE(SUM(d.deaths) FILTER (WHERE d.phase = 'pregnant'), 0)::integer   AS deaths_pregnant,
       COALESCE(SUM(d.deaths) FILTER (WHERE d.phase = 'delivery'), 0)::integer   AS deaths_delivery,
       COALESCE(SUM(d.deaths) FILTER (WHERE d.phase = 'postpartum'), 0)::integer AS deaths_postpartum,
       SUM(d.deaths)::integer AS maternal_deaths
FROM fact.fact_maternal_death d
JOIN dim.region_ancestry a ON a.descendant_id = d.region_id
GROUP BY a.ancestor_id, d.period_id;

COMMENT ON VIEW mart.maternal_deaths_by_region IS
    'Maternal deaths by phase, summed at every region level. AKI numerator.';

CREATE OR REPLACE VIEW mart.child_deaths_by_region AS
SELECT a.ancestor_id AS region_id,
       d.period_id,
       COALESCE(SUM(d.deaths) FILTER (WHERE d.age_band = 'neonatal'), 0)::integer      AS neonatal_deaths,
       COALESCE(SUM(d.deaths) FILTER (WHERE d.age_band = 'post_neonatal'), 0)::integer AS post_neonatal_deaths,
       COALESCE(SUM(d.deaths) FILTER (WHERE d.age_band = 'child_1_4'), 0)::integer     AS child_1_4_deaths,
       COALESCE(SUM(d.deaths) FILTER (WHERE d.age_band IN ('neonatal', 'post_neonatal')), 0)::integer
                                                                                       AS infant_deaths,
       SUM(d.deaths)::integer                                                          AS under5_deaths
FROM fact.fact_child_death d
JOIN dim.region_ancestry a ON a.descendant_id = d.region_id
GROUP BY a.ancestor_id, d.period_id;

COMMENT ON VIEW mart.child_deaths_by_region IS
    'Atomic age bands plus derived infant (neonatal + post-neonatal) and under-5 totals.';

-- ---------------------------------------------------------------------
-- AKI - Angka Kematian Ibu (per 100,000 live births)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW mart.aki AS
SELECT r.region_id,
       r.level,
       r.name                        AS region_name,
       p.period_id,
       p.year,
       COALESCE(b.live_births, 0)    AS live_births,
       COALESCE(m.maternal_deaths, 0) AS maternal_deaths,
       COALESCE(m.deaths_pregnant, 0)   AS deaths_pregnant,
       COALESCE(m.deaths_delivery, 0)   AS deaths_delivery,
       COALESCE(m.deaths_postpartum, 0) AS deaths_postpartum,
       ROUND(COALESCE(m.maternal_deaths, 0) * 100000.0 / NULLIF(b.live_births, 0), 2)
                                     AS aki_per_100k,
       ROUND(ci.lo * 100000, 2)      AS aki_ci95_low,
       ROUND(ci.hi * 100000, 2)      AS aki_ci95_high
FROM dim.dim_region r
CROSS JOIN dim.dim_period p
LEFT JOIN mart.live_births_by_region b
       ON b.region_id = r.region_id AND b.period_id = p.period_id
LEFT JOIN mart.maternal_deaths_by_region m
       ON m.region_id = r.region_id AND m.period_id = p.period_id
CROSS JOIN LATERAL mart.wilson_ci(COALESCE(m.maternal_deaths, 0), COALESCE(b.live_births, 0)) AS ci;

COMMENT ON VIEW mart.aki IS
    'Angka Kematian Ibu = maternal deaths / live births x 100,000, with Wilson 95% CI, at every region level.';

-- ---------------------------------------------------------------------
-- AKB - Angka Kematian Bayi (per 1,000 live births), plus AKN and under-5
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW mart.akb AS
SELECT r.region_id,
       r.level,
       r.name                     AS region_name,
       p.period_id,
       p.year,
       COALESCE(b.live_births, 0) AS live_births,
       COALESCE(c.neonatal_deaths, 0)      AS neonatal_deaths,
       COALESCE(c.post_neonatal_deaths, 0) AS post_neonatal_deaths,
       COALESCE(c.infant_deaths, 0)        AS infant_deaths,
       COALESCE(c.child_1_4_deaths, 0)     AS child_1_4_deaths,
       COALESCE(c.under5_deaths, 0)        AS under5_deaths,
       ROUND(COALESCE(c.neonatal_deaths, 0) * 1000.0 / NULLIF(b.live_births, 0), 2)
                                   AS akn_per_1000,
       ROUND(COALESCE(c.infant_deaths, 0) * 1000.0 / NULLIF(b.live_births, 0), 2)
                                   AS akb_per_1000,
       ROUND(COALESCE(c.under5_deaths, 0) * 1000.0 / NULLIF(b.live_births, 0), 2)
                                   AS akbalita_per_1000,
       ROUND(ci.lo * 1000, 2)      AS akb_ci95_low,
       ROUND(ci.hi * 1000, 2)      AS akb_ci95_high
FROM dim.dim_region r
CROSS JOIN dim.dim_period p
LEFT JOIN mart.live_births_by_region b
       ON b.region_id = r.region_id AND b.period_id = p.period_id
LEFT JOIN mart.child_deaths_by_region c
       ON c.region_id = r.region_id AND c.period_id = p.period_id
CROSS JOIN LATERAL mart.wilson_ci(COALESCE(c.infant_deaths, 0), COALESCE(b.live_births, 0)) AS ci;

COMMENT ON VIEW mart.akb IS
    'Angka Kematian Bayi = infant deaths (neonatal + post-neonatal) / live births x 1,000, with AKN, under-5 rate and Wilson 95% CI.';

-- ---------------------------------------------------------------------
-- AKB by sex (a 102-death total hides a 64 vs 38 split)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW mart.akb_by_sex AS
WITH births AS (
    SELECT a.ancestor_id AS region_id, b.period_id, b.sex,
           SUM(b.live_births)::integer AS live_births
    FROM fact.fact_birth b
    JOIN dim.region_ancestry a ON a.descendant_id = b.region_id
    GROUP BY a.ancestor_id, b.period_id, b.sex
), deaths AS (
    SELECT a.ancestor_id AS region_id, d.period_id, d.sex,
           COALESCE(SUM(d.deaths) FILTER (WHERE d.age_band IN ('neonatal', 'post_neonatal')), 0)::integer
               AS infant_deaths
    FROM fact.fact_child_death d
    JOIN dim.region_ancestry a ON a.descendant_id = d.region_id
    GROUP BY a.ancestor_id, d.period_id, d.sex
)
SELECT r.region_id,
       r.level,
       r.name AS region_name,
       p.period_id,
       p.year,
       s.sex,
       COALESCE(b.live_births, 0)   AS live_births,
       COALESCE(d.infant_deaths, 0) AS infant_deaths,
       ROUND(COALESCE(d.infant_deaths, 0) * 1000.0 / NULLIF(b.live_births, 0), 2)
                                    AS akb_per_1000
FROM dim.dim_region r
CROSS JOIN dim.dim_period p
CROSS JOIN (VALUES ('M'), ('F')) AS s(sex)
LEFT JOIN births b
       ON b.region_id = r.region_id AND b.period_id = p.period_id AND b.sex = s.sex
LEFT JOIN deaths d
       ON d.region_id = r.region_id AND d.period_id = p.period_id AND d.sex = s.sex;

COMMENT ON VIEW mart.akb_by_sex IS
    'Infant mortality rate by sex, for the sex-split panel. Live births are split in the source, so each rate has its own denominator.';

-- ---------------------------------------------------------------------
-- Cause breakdowns (share computed per region + period)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW mart.maternal_death_cause AS
WITH rolled AS (
    SELECT a.ancestor_id AS region_id, f.period_id, f.cause_id,
           SUM(f.deaths)::integer AS deaths
    FROM fact.fact_maternal_death_cause f
    JOIN dim.region_ancestry a ON a.descendant_id = f.region_id
    GROUP BY a.ancestor_id, f.period_id, f.cause_id
)
SELECT r.region_id,
       r.level,
       r.name AS region_name,
       p.period_id,
       p.year,
       c.cause_id,
       c.name AS cause,
       c.sort_order,
       COALESCE(x.deaths, 0) AS deaths,
       ROUND(100.0 * COALESCE(x.deaths, 0)
             / NULLIF(SUM(COALESCE(x.deaths, 0)) OVER (PARTITION BY r.region_id, p.period_id), 0), 2)
             AS share_percent
FROM dim.dim_region r
CROSS JOIN dim.dim_period p
CROSS JOIN dim.dim_cause c
LEFT JOIN rolled x
       ON x.region_id = r.region_id AND x.period_id = p.period_id AND x.cause_id = c.cause_id
WHERE c.cause_group = 'maternal';

COMMENT ON VIEW mart.maternal_death_cause IS
    'Maternal deaths by cause with within-region share. Zero rows are kept so a cause with no deaths still appears in the legend.';

CREATE OR REPLACE VIEW mart.child_death_cause AS
WITH rolled AS (
    SELECT a.ancestor_id AS region_id, f.period_id, f.cause_id,
           MIN(f.age_band) AS age_band,
           SUM(f.deaths)::integer AS deaths
    FROM fact.fact_child_death_cause f
    JOIN dim.region_ancestry a ON a.descendant_id = f.region_id
    GROUP BY a.ancestor_id, f.period_id, f.cause_id
)
SELECT r.region_id,
       r.level,
       r.name AS region_name,
       p.period_id,
       p.year,
       c.cause_group,
       c.cause_id,
       c.name AS cause,
       c.sort_order,
       COALESCE(x.deaths, 0) AS deaths,
       ROUND(100.0 * COALESCE(x.deaths, 0)
             / NULLIF(SUM(COALESCE(x.deaths, 0)) OVER (PARTITION BY r.region_id, p.period_id, c.cause_group), 0), 2)
             AS share_percent
FROM dim.dim_region r
CROSS JOIN dim.dim_period p
CROSS JOIN dim.dim_cause c
LEFT JOIN rolled x
       ON x.region_id = r.region_id AND x.period_id = p.period_id AND x.cause_id = c.cause_id
WHERE c.cause_group IN ('neonatal', 'child');

COMMENT ON VIEW mart.child_death_cause IS
    'Neonatal (0-28 days) and child (12-59 months) deaths by cause, with share within each cause group.';

-- ---------------------------------------------------------------------
-- KPI cards: one row per district per year
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW mart.kpi_summary AS
SELECT a.region_id,
       a.region_name,
       a.period_id,
       a.year,
       a.live_births,
       a.maternal_deaths,
       a.aki_per_100k,
       a.aki_ci95_low,
       a.aki_ci95_high,
       k.neonatal_deaths,
       k.infant_deaths,
       k.under5_deaths,
       k.akn_per_1000,
       k.akb_per_1000,
       k.akbalita_per_1000,
       k.akb_ci95_low,
       k.akb_ci95_high
FROM mart.aki a
JOIN mart.akb k ON k.region_id = a.region_id AND k.period_id = a.period_id
WHERE a.level = 'district';

COMMENT ON VIEW mart.kpi_summary IS
    'Headline AKI/AKB figures for the district, i.e. the KPI cards.';
