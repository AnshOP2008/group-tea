CREATE TABLE IF NOT EXISTS public.site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  path text,
  device_id text
);

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visits_insert" ON public.site_visits FOR INSERT WITH CHECK (true);
CREATE POLICY "visits_read" ON public.site_visits FOR SELECT USING (true);