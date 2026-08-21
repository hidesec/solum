-- Rollback for: Product
-- Created: 2026-08-16T12:19:46.344Z

-- Drop join tables first (FK dependency)
DROP TABLE IF EXISTS public.products_tags CASCADE;

DROP TABLE IF EXISTS public.products CASCADE;
