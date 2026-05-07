
-- Schema for GroupTea
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  roll_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  group_number INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_students_group ON public.students(group_number);

CREATE TABLE public.devices (
  device_id TEXT PRIMARY KEY,
  chosen_group INT,
  fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  group_number INT NOT NULL,
  question INT NOT NULL,
  voted_for UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(device_id, question)
);
CREATE INDEX idx_votes_group_q ON public.votes(group_number, question);

CREATE TABLE public.tea (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  group_number INT NOT NULL,
  message TEXT NOT NULL CHECK (length(message) <= 150 AND length(message) > 0),
  approved BOOLEAN NOT NULL DEFAULT false,
  rejected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tea_group ON public.tea(group_number);

CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings (key, value) VALUES
  ('results_unlock_at', NULL),
  ('admin_password', 'changeme123');

-- Enable RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tea ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Public read for students
CREATE POLICY "students_read" ON public.students FOR SELECT USING (true);

-- Devices: anyone can insert/select/update (anon participation)
CREATE POLICY "devices_read" ON public.devices FOR SELECT USING (true);
CREATE POLICY "devices_insert" ON public.devices FOR INSERT WITH CHECK (true);
CREATE POLICY "devices_update" ON public.devices FOR UPDATE USING (true);

-- Votes: read all, insert/update by anyone (we enforce uniqueness in DB)
CREATE POLICY "votes_read" ON public.votes FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON public.votes FOR INSERT WITH CHECK (true);
CREATE POLICY "votes_update" ON public.votes FOR UPDATE USING (true);

-- Tea: read approved publicly; allow all reads (admin uses same client w/ password gate clientside; admin actions use service role via server fn ideally, but we keep simple)
CREATE POLICY "tea_read" ON public.tea FOR SELECT USING (true);
CREATE POLICY "tea_insert" ON public.tea FOR INSERT WITH CHECK (true);
CREATE POLICY "tea_update" ON public.tea FOR UPDATE USING (true);

-- App settings: public read; updates via server (but allow anon update for simplicity guarded by admin password client-side)
CREATE POLICY "settings_read" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "settings_update" ON public.app_settings FOR UPDATE USING (true);
