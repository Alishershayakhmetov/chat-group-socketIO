-- This is an empty migration.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX users_name_trgm_idx ON users USING gin (name gin_trgm_ops);
CREATE INDEX users_last_name_trgm_idx ON users USING gin (last_name gin_trgm_ops);