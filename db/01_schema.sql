-- =====================================================================
-- Profil Kesehatan Kabupaten/Kota - AKI & AKB pilot schema
-- Target: PostgreSQL 16
--
-- Layering
--   dim   conformed dimensions (region, period, cause, age band)
--   etl   load provenance
--   fact  atomic facts, one table per source table (explicit grain)
--   mart  dashboard views (db/02_views.sql)
--
-- Everything below is additive (IF NOT EXISTS). To rebuild from scratch,
-- run db/00_reset.sql first. Rates are never stored: they are derived in
-- mart.* from counts plus live births, so the denominator can never drift.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS dim;
CREATE SCHEMA IF NOT EXISTS etl;
CREATE SCHEMA IF NOT EXISTS fact;
CREATE SCHEMA IF NOT EXISTS mart;

COMMENT ON SCHEMA dim  IS 'Conformed dimensions: region hierarchy, period, cause of death, age band';
COMMENT ON SCHEMA etl  IS 'Load provenance: one row per workbook import';
COMMENT ON SCHEMA fact IS 'Atomic counts, one table per source table in the Profil Kesehatan workbook';
COMMENT ON SCHEMA mart IS 'Dashboard marts: rates derived from counts, never stored';

-- ---------------------------------------------------------------------
-- etl.import_batch
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS etl.import_batch (
    batch_id    integer     GENERATED ALWAYS AS IDENTITY,
    source_file text        NOT NULL,
    file_sha256 text        NOT NULL,
    source_year smallint,
    district    text,
    loaded_at   timestamptz NOT NULL DEFAULT now(),
    notes       text,
    CONSTRAINT import_batch_pkey PRIMARY KEY (batch_id)
);

COMMENT ON TABLE etl.import_batch IS
    'One row per loaded workbook. Facts reference it so a bad load can be traced or rolled back.';

-- ---------------------------------------------------------------------
-- dim.dim_region  — province > district > subdistrict > health_center
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dim.dim_region (
    region_id  integer     GENERATED ALWAYS AS IDENTITY,
    parent_id  integer,
    level      text        NOT NULL,
    name       text        NOT NULL,
    bps_code   text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT dim_region_pkey PRIMARY KEY (region_id),
    CONSTRAINT dim_region_parent_fk FOREIGN KEY (parent_id)
        REFERENCES dim.dim_region (region_id),
    CONSTRAINT dim_region_level_check CHECK (
        level IN ('province', 'district', 'subdistrict', 'health_center')),
    CONSTRAINT dim_region_no_self_parent CHECK (parent_id IS NULL OR parent_id <> region_id),
    -- NULLS NOT DISTINCT lets the province row (parent_id IS NULL) be upserted too
    CONSTRAINT dim_region_natural_key UNIQUE NULLS NOT DISTINCT (level, parent_id, name)
);

CREATE INDEX IF NOT EXISTS dim_region_parent_idx ON dim.dim_region (parent_id);

COMMENT ON TABLE dim.dim_region IS
    'Region hierarchy. The leaf level is health_center (puskesmas); every fact row is stored at that grain and rolled up via dim.region_ancestry.';
COMMENT ON COLUMN dim.dim_region.bps_code IS
    'BPS code when known (35 province, 3512 district). Left NULL for subdistricts/puskesmas: the workbook carries no codes.';

-- ---------------------------------------------------------------------
-- dim.dim_period
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dim.dim_period (
    period_id smallint GENERATED ALWAYS AS IDENTITY,
    year      smallint NOT NULL,
    CONSTRAINT dim_period_pkey PRIMARY KEY (period_id),
    CONSTRAINT dim_period_year_key UNIQUE (year),
    CONSTRAINT dim_period_year_check CHECK (year BETWEEN 1900 AND 2100)
);

COMMENT ON TABLE dim.dim_period IS
    'One row per reporting year. The workbook reports a single annual period.';

-- ---------------------------------------------------------------------
-- dim.dim_age_band — only the atomic bands the source reports
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dim.dim_age_band (
    age_band     text     NOT NULL,
    label        text     NOT NULL,
    age_min_days integer  NOT NULL,
    age_max_days integer  NOT NULL,
    sort_order   smallint NOT NULL,
    CONSTRAINT dim_age_band_pkey PRIMARY KEY (age_band),
    CONSTRAINT dim_age_band_range_check CHECK (
        age_min_days >= 0 AND age_max_days >= age_min_days)
);

COMMENT ON TABLE dim.dim_age_band IS
    'Atomic age bands: infant = neonatal + post_neonatal and under-5 = infant + child_1_4 are derived in mart.akb, not stored, so they cannot double count.';

INSERT INTO dim.dim_age_band (age_band, label, age_min_days, age_max_days, sort_order)
VALUES
    ('neonatal',      'Neonatal (0-28 hari)',          0,   28,  1),
    ('post_neonatal', 'Post-neonatal (29-365 hari)',  29,  365,  2),
    ('child_1_4',     'Anak balita (12-59 bulan)',   366, 1826,  3)
ON CONFLICT (age_band) DO NOTHING;

-- ---------------------------------------------------------------------
-- dim.dim_cause — cause-of-death catalog, one group per source table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dim.dim_cause (
    cause_id    smallint GENERATED ALWAYS AS IDENTITY,
    cause_group text     NOT NULL,
    name        text     NOT NULL,
    sort_order  smallint NOT NULL,
    CONSTRAINT dim_cause_pkey PRIMARY KEY (cause_id),
    CONSTRAINT dim_cause_group_check CHECK (
        cause_group IN ('maternal', 'neonatal', 'child')),
    CONSTRAINT dim_cause_natural_key UNIQUE (cause_group, name)
);

COMMENT ON TABLE dim.dim_cause IS
    'Cause catalog: maternal (workbook table 25), neonatal (table 36), child 12-59 months (table 37). Empty cause cells in the source are stored as 0 counts.';

-- ---------------------------------------------------------------------
-- fact.fact_birth — source: table 21
-- grain: health_center x period x sex
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fact.fact_birth (
    region_id       integer  NOT NULL,
    period_id       smallint NOT NULL,
    sex             text     NOT NULL,
    live_births     integer  NOT NULL,
    stillbirths     integer  NOT NULL,
    import_batch_id integer  NOT NULL,
    CONSTRAINT fact_birth_pkey PRIMARY KEY (region_id, period_id, sex),
    CONSTRAINT fact_birth_region_fk FOREIGN KEY (region_id)
        REFERENCES dim.dim_region (region_id),
    CONSTRAINT fact_birth_period_fk FOREIGN KEY (period_id)
        REFERENCES dim.dim_period (period_id),
    CONSTRAINT fact_birth_batch_fk FOREIGN KEY (import_batch_id)
        REFERENCES etl.import_batch (batch_id),
    CONSTRAINT fact_birth_sex_check CHECK (sex IN ('M', 'F')),
    CONSTRAINT fact_birth_non_negative CHECK (live_births >= 0 AND stillbirths >= 0)
);

CREATE INDEX IF NOT EXISTS fact_birth_period_idx ON fact.fact_birth (period_id);

COMMENT ON TABLE fact.fact_birth IS
    'Live births and stillbirths by sex (table 21). Denominator for AKI, AKB, AKN and stillbirth rate.';

-- ---------------------------------------------------------------------
-- fact.fact_maternal_death — source: table 23
-- grain: health_center x period x phase
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fact.fact_maternal_death (
    region_id       integer  NOT NULL,
    period_id       smallint NOT NULL,
    phase           text     NOT NULL,
    deaths          integer  NOT NULL,
    import_batch_id integer  NOT NULL,
    CONSTRAINT fact_maternal_death_pkey PRIMARY KEY (region_id, period_id, phase),
    CONSTRAINT fact_maternal_death_region_fk FOREIGN KEY (region_id)
        REFERENCES dim.dim_region (region_id),
    CONSTRAINT fact_maternal_death_period_fk FOREIGN KEY (period_id)
        REFERENCES dim.dim_period (period_id),
    CONSTRAINT fact_maternal_death_batch_fk FOREIGN KEY (import_batch_id)
        REFERENCES etl.import_batch (batch_id),
    CONSTRAINT fact_maternal_death_phase_check CHECK (
        phase IN ('pregnant', 'delivery', 'postpartum')),
    CONSTRAINT fact_maternal_death_non_negative CHECK (deaths >= 0)
);

CREATE INDEX IF NOT EXISTS fact_maternal_death_period_idx
    ON fact.fact_maternal_death (period_id);

COMMENT ON TABLE fact.fact_maternal_death IS
    'Maternal deaths by phase: pregnant (hamil), delivery (bersalin), postpartum (nifas). This is the AKI numerator.';

-- ---------------------------------------------------------------------
-- fact.fact_maternal_death_cause — source: table 25
-- grain: health_center x period x cause
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fact.fact_maternal_death_cause (
    region_id       integer  NOT NULL,
    period_id       smallint NOT NULL,
    cause_id        smallint NOT NULL,
    deaths          integer  NOT NULL,
    import_batch_id integer  NOT NULL,
    CONSTRAINT fact_maternal_death_cause_pkey PRIMARY KEY (region_id, period_id, cause_id),
    CONSTRAINT fact_maternal_death_cause_region_fk FOREIGN KEY (region_id)
        REFERENCES dim.dim_region (region_id),
    CONSTRAINT fact_maternal_death_cause_period_fk FOREIGN KEY (period_id)
        REFERENCES dim.dim_period (period_id),
    CONSTRAINT fact_maternal_death_cause_cause_fk FOREIGN KEY (cause_id)
        REFERENCES dim.dim_cause (cause_id),
    CONSTRAINT fact_maternal_death_cause_batch_fk FOREIGN KEY (import_batch_id)
        REFERENCES etl.import_batch (batch_id),
    CONSTRAINT fact_maternal_death_cause_non_negative CHECK (deaths >= 0)
);

CREATE INDEX IF NOT EXISTS fact_maternal_death_cause_period_idx
    ON fact.fact_maternal_death_cause (period_id);

COMMENT ON TABLE fact.fact_maternal_death_cause IS
    'Maternal deaths by cause (table 25). Kept separate from fact_maternal_death because the source does not cross cause with phase; the loader reconciles both totals to 11.';

-- ---------------------------------------------------------------------
-- fact.fact_child_death — source: table 34
-- grain: health_center x period x sex x age_band
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fact.fact_child_death (
    region_id       integer  NOT NULL,
    period_id       smallint NOT NULL,
    sex             text     NOT NULL,
    age_band        text     NOT NULL,
    deaths          integer  NOT NULL,
    import_batch_id integer  NOT NULL,
    CONSTRAINT fact_child_death_pkey PRIMARY KEY (region_id, period_id, sex, age_band),
    CONSTRAINT fact_child_death_region_fk FOREIGN KEY (region_id)
        REFERENCES dim.dim_region (region_id),
    CONSTRAINT fact_child_death_period_fk FOREIGN KEY (period_id)
        REFERENCES dim.dim_period (period_id),
    CONSTRAINT fact_child_death_age_band_fk FOREIGN KEY (age_band)
        REFERENCES dim.dim_age_band (age_band),
    CONSTRAINT fact_child_death_batch_fk FOREIGN KEY (import_batch_id)
        REFERENCES etl.import_batch (batch_id),
    CONSTRAINT fact_child_death_sex_check CHECK (sex IN ('M', 'F')),
    CONSTRAINT fact_child_death_non_negative CHECK (deaths >= 0)
);

CREATE INDEX IF NOT EXISTS fact_child_death_period_idx ON fact.fact_child_death (period_id);

COMMENT ON TABLE fact.fact_child_death IS
    'Neonatal, post-neonatal and 12-59 month deaths by sex (table 34). The source''s "bayi" and "anak balita" columns are cross-checks only: infant and under-5 totals are derived from the atomic bands.';

-- ---------------------------------------------------------------------
-- fact.fact_child_death_cause — sources: tables 36 (neonatal), 37 (child)
-- grain: health_center x period x cause
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fact.fact_child_death_cause (
    region_id       integer  NOT NULL,
    period_id       smallint NOT NULL,
    cause_id        smallint NOT NULL,
    age_band        text     NOT NULL,
    deaths          integer  NOT NULL,
    import_batch_id integer  NOT NULL,
    CONSTRAINT fact_child_death_cause_pkey PRIMARY KEY (region_id, period_id, cause_id),
    CONSTRAINT fact_child_death_cause_region_fk FOREIGN KEY (region_id)
        REFERENCES dim.dim_region (region_id),
    CONSTRAINT fact_child_death_cause_period_fk FOREIGN KEY (period_id)
        REFERENCES dim.dim_period (period_id),
    CONSTRAINT fact_child_death_cause_cause_fk FOREIGN KEY (cause_id)
        REFERENCES dim.dim_cause (cause_id),
    CONSTRAINT fact_child_death_cause_age_band_fk FOREIGN KEY (age_band)
        REFERENCES dim.dim_age_band (age_band),
    CONSTRAINT fact_child_death_cause_batch_fk FOREIGN KEY (import_batch_id)
        REFERENCES etl.import_batch (batch_id),
    CONSTRAINT fact_child_death_cause_non_negative CHECK (deaths >= 0)
);

CREATE INDEX IF NOT EXISTS fact_child_death_cause_period_idx
    ON fact.fact_child_death_cause (period_id);

COMMENT ON TABLE fact.fact_child_death_cause IS
    'Cause of death for neonatal and 12-59 month deaths. age_band disambiguates which source table a cause came from.';
