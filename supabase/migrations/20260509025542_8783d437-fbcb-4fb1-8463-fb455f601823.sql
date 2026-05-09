-- Tea votes: add direction (1=up, -1=down). Existing rows are upvotes.
ALTER TABLE public.tea_upvotes ADD COLUMN IF NOT EXISTS value smallint NOT NULL DEFAULT 1;

-- Comments: threading + soft delete
ALTER TABLE public.tea_comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.tea_comments(id) ON DELETE CASCADE;
ALTER TABLE public.tea_comments ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;

-- Comment votes table
CREATE TABLE IF NOT EXISTS public.tea_comment_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.tea_comments(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  value smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tea_comment_votes_unique UNIQUE (comment_id, device_id)
);
ALTER TABLE public.tea_comment_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cv_read ON public.tea_comment_votes;
DROP POLICY IF EXISTS cv_insert ON public.tea_comment_votes;
DROP POLICY IF EXISTS cv_update ON public.tea_comment_votes;
DROP POLICY IF EXISTS cv_delete ON public.tea_comment_votes;
CREATE POLICY cv_read ON public.tea_comment_votes FOR SELECT USING (true);
CREATE POLICY cv_insert ON public.tea_comment_votes FOR INSERT WITH CHECK (true);
CREATE POLICY cv_update ON public.tea_comment_votes FOR UPDATE USING (true);
CREATE POLICY cv_delete ON public.tea_comment_votes FOR DELETE USING (true);

-- Allow multiple group votes per device (one vote per question per group)
CREATE UNIQUE INDEX IF NOT EXISTS votes_device_group_question_uniq
  ON public.votes(device_id, group_number, question);
