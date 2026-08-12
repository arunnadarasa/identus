CREATE TABLE public.sprite_boxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE UNIQUE,
  sprite_name TEXT NOT NULL,
  url TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  provision_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  sdk_ready BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sprite_boxes TO authenticated;
GRANT ALL ON public.sprite_boxes TO service_role;
ALTER TABLE public.sprite_boxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own sandbox" ON public.sprite_boxes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.sprite_snippets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  last_output TEXT,
  last_exit_code INTEGER,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sprite_snippets_user_idx ON public.sprite_snippets (user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sprite_snippets TO authenticated;
GRANT ALL ON public.sprite_snippets TO service_role;
ALTER TABLE public.sprite_snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own snippets" ON public.sprite_snippets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_sprite_boxes_updated_at BEFORE UPDATE ON public.sprite_boxes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sprite_snippets_updated_at BEFORE UPDATE ON public.sprite_snippets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();