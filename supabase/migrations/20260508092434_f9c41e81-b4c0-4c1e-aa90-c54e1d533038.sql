ALTER TABLE public.tea DROP CONSTRAINT IF EXISTS tea_device_id_key;
ALTER TABLE public.tea ADD COLUMN IF NOT EXISTS priority integer;
CREATE INDEX IF NOT EXISTS tea_device_id_idx ON public.tea(device_id);
CREATE INDEX IF NOT EXISTS tea_priority_idx ON public.tea(priority);