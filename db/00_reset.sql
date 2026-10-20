-- Destructive: drops every object this project creates.
-- Only use against a development database (the docker container in README).
DROP VIEW IF EXISTS public.v_kpi_summary, public.v_aki, public.v_akb,
                    public.v_akb_by_sex, public.v_maternal_death_cause,
                    public.v_child_death_cause, public.v_live_births_by_region,
                    public.v_regions, public.v_region_aki_akb, public.v_causes,
                    public.v_import_batches,
                    public.v_fact_birth, public.v_fact_maternal_death,
                    public.v_fact_maternal_death_cause, public.v_fact_child_death,
                    public.v_fact_child_death_cause CASCADE;
DROP SCHEMA IF EXISTS mart CASCADE;
DROP SCHEMA IF EXISTS fact CASCADE;
DROP SCHEMA IF EXISTS dim  CASCADE;
DROP SCHEMA IF EXISTS etl  CASCADE;
