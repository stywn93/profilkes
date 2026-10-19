-- Destructive: drops every object this project creates.
-- Only use against a development database (the docker container in README).
DROP SCHEMA IF EXISTS mart CASCADE;
DROP SCHEMA IF EXISTS fact CASCADE;
DROP SCHEMA IF EXISTS dim  CASCADE;
DROP SCHEMA IF EXISTS etl  CASCADE;
