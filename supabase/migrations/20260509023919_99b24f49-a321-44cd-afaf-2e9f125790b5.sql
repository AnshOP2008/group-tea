-- Add comments_closed flag to tea
ALTER TABLE public.tea ADD COLUMN IF NOT EXISTS comments_closed boolean NOT NULL DEFAULT false;

-- Upvotes table (one upvote per device per tea)
CREATE TABLE IF NOT EXISTS public.tea_upvotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tea_id uuid NOT NULL REFERENCES public.tea(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tea_id, device_id)
);
ALTER TABLE public.tea_upvotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "upvotes_read" ON public.tea_upvotes FOR SELECT USING (true);
CREATE POLICY "upvotes_insert" ON public.tea_upvotes FOR INSERT WITH CHECK (true);
CREATE POLICY "upvotes_delete" ON public.tea_upvotes FOR DELETE USING (true);

-- Comments table
CREATE TABLE IF NOT EXISTS public.tea_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tea_id uuid NOT NULL REFERENCES public.tea(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tea_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_read" ON public.tea_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON public.tea_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "comments_delete" ON public.tea_comments FOR DELETE USING (true);
CREATE POLICY "comments_update" ON public.tea_comments FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS tea_comments_tea_id_idx ON public.tea_comments(tea_id);
CREATE INDEX IF NOT EXISTS tea_upvotes_tea_id_idx ON public.tea_upvotes(tea_id);