ALTER TABLE public.portfolio_items
  ADD COLUMN category text NOT NULL DEFAULT '',
  ADD COLUMN client_name text NOT NULL DEFAULT '',
  ADD COLUMN completion_year smallint CHECK (completion_year IS NULL OR completion_year BETWEEN 1900 AND 2100),
  ADD COLUMN project_url text NOT NULL DEFAULT '',
  ADD COLUMN tools text[] NOT NULL DEFAULT '{}',
  ADD COLUMN results text NOT NULL DEFAULT '',
  ADD COLUMN image_urls text[] NOT NULL DEFAULT '{}';

UPDATE public.portfolio_items
SET image_urls = ARRAY[image_url]
WHERE cardinality(image_urls) = 0 AND image_url <> '';

COMMENT ON COLUMN public.portfolio_items.image_url IS 'Primary image retained for backwards compatibility';
COMMENT ON COLUMN public.portfolio_items.image_urls IS 'Ordered project screenshot URLs, including the primary image';