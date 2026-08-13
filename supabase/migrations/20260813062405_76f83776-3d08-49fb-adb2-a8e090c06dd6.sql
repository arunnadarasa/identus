DELETE FROM public.agent_connections WHERE fly_app_name IN ('identus-agent-5ce1','identus-agent-5fe0');

UPDATE public.agent_connections c
SET is_active = true
WHERE c.mode = 'simulated'
  AND NOT EXISTS (
    SELECT 1 FROM public.agent_connections a
    WHERE a.user_id = c.user_id AND a.is_active = true
  );