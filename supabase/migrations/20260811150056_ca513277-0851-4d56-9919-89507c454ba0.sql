-- roles
CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- agent connections
CREATE TABLE public.agent_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  mode text NOT NULL DEFAULT 'simulated',
  base_url text,
  api_key text,
  wallet_id text,
  fly_app_name text,
  fly_region text,
  provision_status text,
  provision_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  last_health text,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_connections TO authenticated;
GRANT ALL ON public.agent_connections TO service_role;
ALTER TABLE public.agent_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agent connections" ON public.agent_connections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER agent_connections_updated BEFORE UPDATE ON public.agent_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX agent_connections_user_idx ON public.agent_connections(user_id);

CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.agent_connections(id) ON DELETE SET NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  summary text,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activity" ON public.activity_log FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX activity_log_user_idx ON public.activity_log(user_id, created_at DESC);

CREATE TABLE public.saved_dids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.agent_connections(id) ON DELETE CASCADE,
  did text NOT NULL,
  alias text,
  role text NOT NULL DEFAULT 'issuer',
  status text NOT NULL DEFAULT 'CREATED',
  purpose text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_dids TO authenticated;
GRANT ALL ON public.saved_dids TO service_role;
ALTER TABLE public.saved_dids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own dids" ON public.saved_dids FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.credential_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.agent_connections(id) ON DELETE CASCADE,
  record_id text NOT NULL,
  subject text,
  issuer_did text,
  holder_did text,
  schema_name text,
  claims jsonb NOT NULL DEFAULT '{}'::jsonb,
  protocol_state text NOT NULL DEFAULT 'OfferSent',
  jwt text,
  verified boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credential_records TO authenticated;
GRANT ALL ON public.credential_records TO service_role;
ALTER TABLE public.credential_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own credentials" ON public.credential_records FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER credential_records_updated BEFORE UPDATE ON public.credential_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- simulated agent state (peer connections + presentations)
CREATE TABLE public.sim_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.agent_connections(id) ON DELETE CASCADE,
  label text NOT NULL,
  their_did text,
  my_did text,
  state text NOT NULL DEFAULT 'InvitationGenerated',
  invitation_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sim_connections TO authenticated;
GRANT ALL ON public.sim_connections TO service_role;
ALTER TABLE public.sim_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sim connections" ON public.sim_connections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.sim_presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.agent_connections(id) ON DELETE CASCADE,
  credential_record_id uuid REFERENCES public.credential_records(id) ON DELETE SET NULL,
  verifier_did text,
  state text NOT NULL DEFAULT 'RequestSent',
  result text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sim_presentations TO authenticated;
GRANT ALL ON public.sim_presentations TO service_role;
ALTER TABLE public.sim_presentations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sim presentations" ON public.sim_presentations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.credential_schemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.agent_connections(id) ON DELETE CASCADE,
  name text NOT NULL,
  version text NOT NULL DEFAULT '1.0.0',
  author_did text,
  attributes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credential_schemas TO authenticated;
GRANT ALL ON public.credential_schemas TO service_role;
ALTER TABLE public.credential_schemas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own schemas" ON public.credential_schemas FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- new user bootstrap: profile, role, seeded simulated connection and demo data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE conn_id uuid; issuer_did text; holder_did text;
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  INSERT INTO public.agent_connections (user_id, name, mode, is_active, provision_status, last_health)
  VALUES (NEW.id, 'Simulated Agent', 'simulated', true, 'ready', 'healthy')
  RETURNING id INTO conn_id;

  issuer_did := 'did:prism:' || encode(digest(NEW.id::text || 'issuer', 'sha256'), 'hex');
  holder_did := 'did:prism:' || encode(digest(NEW.id::text || 'holder', 'sha256'), 'hex');

  INSERT INTO public.saved_dids (user_id, connection_id, did, alias, role, status, purpose)
  VALUES (NEW.id, conn_id, issuer_did, 'University Issuer', 'issuer', 'PUBLISHED', 'assertionMethod'),
         (NEW.id, conn_id, holder_did, 'Alice (Holder)', 'holder', 'PUBLISHED', 'authentication');

  INSERT INTO public.credential_schemas (user_id, connection_id, name, version, author_did, attributes)
  VALUES (NEW.id, conn_id, 'UniversityDegree', '1.0.0', issuer_did, '["degree","graduationYear","name"]'::jsonb);

  INSERT INTO public.credential_records (user_id, connection_id, record_id, subject, issuer_did, holder_did, schema_name, claims, protocol_state, verified)
  VALUES (NEW.id, conn_id, 'demo-cred-0001', 'Alice Doe', issuer_did, holder_did, 'UniversityDegree',
    '{"degree":"BSc Computer Science","graduationYear":"2025","name":"Alice Doe"}'::jsonb, 'CredentialReceived', true);

  INSERT INTO public.sim_connections (user_id, connection_id, label, their_did, my_did, state)
  VALUES (NEW.id, conn_id, 'Alice <-> University', holder_did, issuer_did, 'ConnectionResponseSent');

  INSERT INTO public.activity_log (user_id, connection_id, kind, status, summary)
  VALUES (NEW.id, conn_id, 'workspace.seeded', 'ok', 'Simulated agent ready with sample DIDs and one verified credential');

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();