ALTER TABLE public.credential_records ADD COLUMN IF NOT EXISTS jwt_source TEXT;
ALTER TABLE public.sprite_snippets ADD COLUMN IF NOT EXISTS template_version TEXT;