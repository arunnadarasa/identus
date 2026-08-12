ALTER TABLE public.agent_connections
  ADD COLUMN IF NOT EXISTS readiness_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS readiness_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS readiness_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz;

UPDATE public.agent_connections SET readiness_status = 'ready', ready_at = COALESCE(ready_at, created_at) WHERE mode = 'simulated' AND readiness_status <> 'ready';