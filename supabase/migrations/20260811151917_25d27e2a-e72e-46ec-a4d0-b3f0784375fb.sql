CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE conn_id uuid; issuer_did text; holder_did text;
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  INSERT INTO public.agent_connections (user_id, name, mode, is_active, provision_status, last_health)
  VALUES (NEW.id, 'Simulated Agent', 'simulated', true, 'ready', 'healthy')
  RETURNING id INTO conn_id;

  issuer_did := 'did:prism:' || md5(NEW.id::text || 'issuer') || md5(NEW.id::text || 'issuer2');
  holder_did := 'did:prism:' || md5(NEW.id::text || 'holder') || md5(NEW.id::text || 'holder2');

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
END; $function$;