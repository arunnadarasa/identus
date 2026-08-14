CREATE TABLE public.agentic_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('a2a','ap2','ucp','x402')),
  status TEXT NOT NULL DEFAULT 'open',
  simulated BOOLEAN NOT NULL DEFAULT true,
  buyer_did TEXT,
  seller_did TEXT,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agentic_sessions TO authenticated;
GRANT ALL ON public.agentic_sessions TO service_role;

ALTER TABLE public.agentic_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own agentic sessions"
ON public.agentic_sessions FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX agentic_sessions_user_kind_idx ON public.agentic_sessions (user_id, kind, created_at DESC);

CREATE TRIGGER update_agentic_sessions_updated_at
BEFORE UPDATE ON public.agentic_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();