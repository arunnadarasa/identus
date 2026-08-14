ALTER TABLE public.saved_dids
  ADD COLUMN IF NOT EXISTS long_form_did text,
  ADD COLUMN IF NOT EXISTS publish_error text;