-- Auto-generated from entity: Tag
-- Schema: public
-- Created: 2026-08-16T12:19:46.342Z

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_tags_name ON public.tags(name);
