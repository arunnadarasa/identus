CREATE TABLE public.compose_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  last_result JSONB,
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compose_files TO authenticated;
GRANT ALL ON public.compose_files TO service_role;

ALTER TABLE public.compose_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own compose files"
ON public.compose_files FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_compose_files_updated_at
BEFORE UPDATE ON public.compose_files
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();