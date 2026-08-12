export type AgentMode = "simulated" | "docker" | "fly";

export interface AgentConnection {
  id: string;
  name: string;
  mode: AgentMode;
  base_url: string | null;
  wallet_id: string | null;
  fly_app_name: string | null;
  fly_region: string | null;
  provision_status: string | null;
  provision_log: ProvisionStep[];
  is_active: boolean;
  last_health: string | null;
  last_checked_at: string | null;
  has_api_key?: boolean;
  last_probe?: ProbeResult | null;
}

export interface ProbeCheck {
  id: string;
  label: string;
  ok: boolean;
  status?: number;
  ms: number;
  detail?: string;
}

export interface ProbeResult {
  healthy: boolean;
  version?: string;
  message: string;
  totalMs: number;
  startedAt: string;
  checks: ProbeCheck[];
}

export interface ProvisionStep {
  step: string;
  status: "ok" | "error" | "running";
  detail?: string;
  at: string;
}

export interface DidRecord {
  id: string;
  did: string;
  alias: string | null;
  role: string;
  status: string;
  purpose: string | null;
  created_at: string;
}

export interface PeerConnection {
  id: string;
  label: string;
  their_did: string | null;
  my_did: string | null;
  state: string;
  invitation_url: string | null;
  created_at: string;
}

export interface CredentialRecord {
  id: string;
  record_id: string;
  subject: string | null;
  issuer_did: string | null;
  holder_did: string | null;
  schema_name: string | null;
  claims: Record<string, string>;
  protocol_state: string;
  jwt: string | null;
  verified: boolean | null;
  created_at: string;
}

export interface SchemaRecord {
  id: string;
  name: string;
  version: string;
  author_did: string | null;
  attributes: string[];
  created_at: string;
}

export interface ActivityEntry {
  id: string;
  kind: string;
  status: string;
  summary: string | null;
  created_at: string;
}

export interface HealthResult {
  healthy: boolean;
  version?: string;
  message: string;
}

export const MODE_LABELS: Record<AgentMode, string> = {
  simulated: "Simulated",
  docker: "Docker local",
  fly: "Fly.io",
};
