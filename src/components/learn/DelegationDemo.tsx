import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TruncatedMono, shortenId } from "@/components/MonoValue";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Ban,
  Bot,
  CheckCircle2,
  Clock,
  FileSignature,
  KeyRound,
  Loader2,
  ShieldCheck,
  Wand2,
  XCircle,
} from "lucide-react";

/* ---------------------------------- data --------------------------------- */

type Preset = {
  id: string;
  label: string;
  scope: string;
  cap: number;
  currency: string;
  action: { summary: string; scope: string; amount: number };
  verifier: string;
};

const PRESETS: Preset[] = [
  {
    id: "flight",
    label: "Book a flight",
    scope: "book:flight",
    cap: 400,
    currency: "EUR",
    action: { summary: "Book LHR → DUB, 22 Sep", scope: "book:flight", amount: 320 },
    verifier: "Aer Sky airline agent",
  },
  {
    id: "groceries",
    label: "Buy groceries",
    scope: "buy:groceries",
    cap: 80,
    currency: "EUR",
    action: { summary: "Weekly shop, 14 items", scope: "buy:groceries", amount: 62 },
    verifier: "FreshCart merchant agent",
  },
];

const EXPIRY_OPTIONS = [
  { label: "1 hour", hours: 1 },
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 24 * 7 },
];

type Twist =
  | "none"
  | "over-cap"
  | "out-of-scope"
  | "expired"
  | "tampered"
  | "revoked";

const TWISTS: { id: Twist; label: string; hint: string }[] = [
  { id: "over-cap", label: "Over the cap", hint: "Agent tries to spend more than allowed" },
  { id: "out-of-scope", label: "Out of scope", hint: "Agent tries a different kind of action" },
  { id: "expired", label: "Expired mandate", hint: "Permission window has closed" },
  { id: "tampered", label: "Tampered credential", hint: "Payload edited after signing" },
  { id: "revoked", label: "Revoked mandate", hint: "Alice cancelled the permission" },
];

type CheckId =
  | "signature"
  | "issuer"
  | "subject"
  | "scope"
  | "cap"
  | "expiry"
  | "revocation";

const CHECKS: { id: CheckId; label: string; hop: string }[] = [
  { id: "signature", label: "Signature is valid", hop: "Hop 2 — Alice signed the permission" },
  { id: "issuer", label: "Issuer is Alice's DID", hop: "Hop 1 — Alice's identity" },
  { id: "subject", label: "Subject is this agent", hop: "Hop 3 — the agent holds the badge" },
  { id: "scope", label: "Scope covers the action", hop: "Hop 4 — acting with proof" },
  { id: "cap", label: "Amount within spend cap", hop: "Hop 4 — acting with proof" },
  { id: "expiry", label: "Mandate not expired", hop: "Hop 4 — acting with proof" },
  { id: "revocation", label: "Mandate not revoked", hop: "Hop 5 — the verifier decides" },
];

type CheckState = "pending" | "running" | "pass" | "fail" | "skipped";

/* --------------------------------- crypto -------------------------------- */

const b64url = (bytes: Uint8Array) => {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64urlDecode = (s: string) => {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const encodeJson = (obj: unknown) =>
  b64url(new TextEncoder().encode(JSON.stringify(obj)));

const randomHex = (n: number) => {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

type Mandate = {
  iss: string;
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  vc: {
    type: string[];
    credentialSubject: {
      id: string;
      delegatedBy: string;
      scope: string;
      spendCap: number;
      currency: string;
    };
  };
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* -------------------------------- component ------------------------------- */

export function DelegationDemo() {
  const [preset, setPreset] = useState<Preset>(PRESETS[0]!);
  const [cap, setCap] = useState<number>(PRESETS[0]!.cap);
  const [expiryHours, setExpiryHours] = useState<number>(24);

  const [dids] = useState(() => ({
    alice: `did:prism:${randomHex(16)}`,
    agent: `did:prism:${randomHex(16)}`,
  }));

  const keyRef = useRef<CryptoKeyPair | null>(null);
  const [keyReady, setKeyReady] = useState(false);

  const [token, setToken] = useState<string | null>(null);
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [issuing, setIssuing] = useState(false);

  const [twist, setTwist] = useState<Twist>("none");
  const [states, setStates] = useState<Record<CheckId, CheckState>>(
    () => Object.fromEntries(CHECKS.map((c) => [c.id, "pending"])) as Record<CheckId, CheckState>,
  );
  const [verdict, setVerdict] = useState<
    { ok: boolean; reason: string; failed?: CheckId } | null
  >(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    crypto.subtle
      .generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"])
      .then((pair) => {
        if (cancelled) return;
        keyRef.current = pair;
        setKeyReady(true);
      })
      .catch(() => setKeyReady(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const resetTrace = useCallback(() => {
    setStates(
      Object.fromEntries(CHECKS.map((c) => [c.id, "pending"])) as Record<CheckId, CheckState>,
    );
    setVerdict(null);
  }, []);

  const choosePreset = (p: Preset) => {
    setPreset(p);
    setCap(p.cap);
    setToken(null);
    setMandate(null);
    setTwist("none");
    resetTrace();
  };

  const issue = async () => {
    const pair = keyRef.current;
    if (!pair) return;
    setIssuing(true);
    resetTrace();
    setTwist("none");
    const now = Math.floor(Date.now() / 1000);
    const payload: Mandate = {
      iss: dids.alice,
      sub: dids.agent,
      jti: `urn:uuid:${randomHex(8)}`,
      iat: now,
      exp: now + expiryHours * 3600,
      vc: {
        type: ["VerifiableCredential", "AgentDelegation"],
        credentialSubject: {
          id: dids.agent,
          delegatedBy: dids.alice,
          scope: preset.scope,
          spendCap: cap,
          currency: preset.currency,
        },
      },
    };
    const header = { alg: "ES256", typ: "JWT" };
    const signingInput = `${encodeJson(header)}.${encodeJson(payload)}`;
    const sig = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      pair.privateKey,
      new TextEncoder().encode(signingInput),
    );
    await sleep(350);
    setMandate(payload);
    setToken(`${signingInput}.${b64url(new Uint8Array(sig))}`);
    setIssuing(false);
  };

  const verify = async (mode: Twist) => {
    if (!token || !mandate || !keyRef.current) return;
    setTwist(mode);
    setRunning(true);
    resetTrace();

    // Build the presented token + proposed action for this run.
    let presented = token;
    if (mode === "tampered") {
      const [h, p, s] = token.split(".") as [string, string, string];
      const edited = JSON.parse(new TextDecoder().decode(b64urlDecode(p))) as Mandate;
      edited.vc.credentialSubject.spendCap = mandate.vc.credentialSubject.spendCap * 25;
      presented = `${h}.${encodeJson(edited)}.${s}`;
    }
    if (mode === "expired") {
      const [h, p] = token.split(".") as [string, string];
      const edited = JSON.parse(new TextDecoder().decode(b64urlDecode(p))) as Mandate;
      edited.iat = Math.floor(Date.now() / 1000) - 7200;
      edited.exp = Math.floor(Date.now() / 1000) - 3600;
      const signingInput = `${h}.${encodeJson(edited)}`;
      const sig = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        keyRef.current.privateKey,
        new TextEncoder().encode(signingInput),
      );
      presented = `${signingInput}.${b64url(new Uint8Array(sig))}`;
    }

    const action = {
      summary:
        mode === "over-cap"
          ? `${preset.action.summary} (premium fare)`
          : mode === "out-of-scope"
            ? "Transfer EUR 500 to a new payee"
            : preset.action.summary,
      scope: mode === "out-of-scope" ? "transfer:funds" : preset.action.scope,
      amount:
        mode === "over-cap"
          ? Math.round(cap * 2.5)
          : mode === "out-of-scope"
            ? 500
            : preset.action.amount,
    };

    const [h, p, s] = presented.split(".") as [string, string, string];
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(p))) as Mandate;
    const sigOk = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      keyRef.current.publicKey,
      b64urlDecode(s),
      new TextEncoder().encode(`${h}.${p}`),
    );
    const nowSec = Math.floor(Date.now() / 1000);

    const results: { id: CheckId; ok: boolean; reason: string }[] = [
      {
        id: "signature",
        ok: sigOk,
        reason: "Credential was edited after Alice signed it — the signature no longer matches.",
      },
      { id: "issuer", ok: claims.iss === dids.alice, reason: "Issuer DID is not Alice." },
      { id: "subject", ok: claims.sub === dids.agent, reason: "Credential was issued to a different agent." },
      {
        id: "scope",
        ok: claims.vc.credentialSubject.scope === action.scope,
        reason: `Mandate allows "${claims.vc.credentialSubject.scope}" but the agent asked for "${action.scope}".`,
      },
      {
        id: "cap",
        ok: action.amount <= claims.vc.credentialSubject.spendCap,
        reason: `Action is ${preset.currency} ${action.amount} but the cap is ${preset.currency} ${claims.vc.credentialSubject.spendCap}.`,
      },
      { id: "expiry", ok: claims.exp > nowSec, reason: "The mandate expired — permission windows are time-boxed." },
      { id: "revocation", ok: mode !== "revoked", reason: "Alice revoked this mandate, so the verifier refuses it." },
    ];

    let failed: { id: CheckId; reason: string } | null = null;
    for (const r of results) {
      setStates((prev) => ({ ...prev, [r.id]: "running" }));
      await sleep(260);
      if (!r.ok) {
        setStates((prev) => ({ ...prev, [r.id]: "fail" }));
        failed = { id: r.id, reason: r.reason };
        break;
      }
      setStates((prev) => ({ ...prev, [r.id]: "pass" }));
    }

    if (failed) {
      const idx = results.findIndex((r) => r.id === failed!.id);
      setStates((prev) => {
        const next = { ...prev };
        results.slice(idx + 1).forEach((r) => (next[r.id] = "skipped"));
        return next;
      });
      setVerdict({ ok: false, reason: failed.reason, failed: failed.id });
    } else {
      setVerdict({
        ok: true,
        reason: `${preset.verifier} accepted the delegated action: ${action.summary} for ${preset.currency} ${action.amount}.`,
      });
    }
    setRunning(false);
  };

  const activeTwist = useMemo(() => TWISTS.find((t) => t.id === twist), [twist]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="font-display text-base">
            Issue a delegation credential, then verify the action
          </CardTitle>
          <Badge variant="secondary" className="gap-1">
            <KeyRound className="size-3" /> real ES256 signatures
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Alice grants her AI agent a narrow, time-boxed mandate. The agent then
          tries an action and a verifier checks it, hop by hop. Signing and
          verification really happen in your browser with WebCrypto — the DIDs
          and the airline are illustrative.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step 1 — mandate */}
        <section className="rounded-lg border bg-muted/30 p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <Wand2 className="size-4 text-primary" /> 1. Set the mandate
          </h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant={preset.id === p.id ? "default" : "outline"}
                onClick={() => choosePreset(p)}
                disabled={running || issuing}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Spend cap ({preset.currency})
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[Math.round(preset.cap / 2), preset.cap, preset.cap * 2].map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    variant={cap === v ? "secondary" : "ghost"}
                    className="border"
                    onClick={() => {
                      setCap(v);
                      setToken(null);
                      setMandate(null);
                      resetTrace();
                    }}
                    disabled={running || issuing}
                  >
                    {preset.currency} {v}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Valid for</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {EXPIRY_OPTIONS.map((o) => (
                  <Button
                    key={o.hours}
                    size="sm"
                    variant={expiryHours === o.hours ? "secondary" : "ghost"}
                    className="border"
                    onClick={() => {
                      setExpiryHours(o.hours);
                      setToken(null);
                      setMandate(null);
                      resetTrace();
                    }}
                    disabled={running || issuing}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Scope <code className="font-mono">{preset.scope}</code> — everything
            else stays off-limits, whatever the agent is asked to do.
          </p>
        </section>

        {/* Step 2 — issue */}
        <section className="rounded-lg border p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <FileSignature className="size-4 text-primary" /> 2. Issue it to the agent
          </h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <TruncatedMono label="Alice (delegator DID)" value={dids.alice} />
            <TruncatedMono label="Agent (subject DID)" value={dids.agent} />
          </div>
          <Button
            className="mt-4 w-full sm:w-auto"
            onClick={issue}
            disabled={!keyReady || issuing || running}
          >
            {issuing ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Signing…
              </>
            ) : (
              <>
                <FileSignature className="size-4" />
                {token ? "Re-issue delegation credential" : "Issue delegation credential"}
              </>
            )}
          </Button>
          {!keyReady && (
            <p className="mt-2 text-xs text-muted-foreground">Generating a keypair…</p>
          )}

          {mandate && token && (
            <div className="mt-4 space-y-3">
              <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs sm:grid-cols-2">
                <Row k="type" v="AgentDelegation" />
                <Row k="scope" v={mandate.vc.credentialSubject.scope} />
                <Row
                  k="spendCap"
                  v={`${mandate.vc.credentialSubject.currency} ${mandate.vc.credentialSubject.spendCap}`}
                />
                <Row k="expires" v={new Date(mandate.exp * 1000).toLocaleString()} />
                <Row k="delegatedBy" v={shortenId(mandate.iss, 10, 6)} />
                <Row k="subject" v={shortenId(mandate.sub, 10, 6)} />
              </div>
              <TruncatedMono label="Signed credential (JWT)" value={token} />
            </div>
          )}
        </section>

        {/* Step 3 — verify */}
        <section className="rounded-lg border p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-primary" /> 3. Agent acts, verifier checks
          </h4>
          <p className="mt-2 text-xs text-muted-foreground">
            <Bot className="mr-1 inline size-3.5" />
            The agent presents the credential to {preset.verifier} with a proposed
            action.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => verify("none")} disabled={!token || running}>
              {running && twist === "none" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Run the honest action
            </Button>
            {TWISTS.map((t) => (
              <Button
                key={t.id}
                size="sm"
                variant="outline"
                onClick={() => verify(t.id)}
                disabled={!token || running}
                title={t.hint}
              >
                {t.id === "expired" ? (
                  <Clock className="size-4" />
                ) : t.id === "revoked" ? (
                  <Ban className="size-4" />
                ) : (
                  <AlertTriangle className="size-4" />
                )}
                {t.label}
              </Button>
            ))}
          </div>
          {!token && (
            <p className="mt-2 text-xs text-muted-foreground">
              Issue the credential first.
            </p>
          )}
          {activeTwist && (
            <p className="mt-3 text-xs text-muted-foreground">
              Trying: <span className="font-medium text-foreground">{activeTwist.label}</span> — {activeTwist.hint}.
            </p>
          )}

          <ul className="mt-4 space-y-2">
            {CHECKS.map((c) => {
              const st = states[c.id];
              return (
                <li
                  key={c.id}
                  className={cn(
                    "flex items-start gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
                    st === "pass" && "border-primary/40 bg-primary/5",
                    st === "fail" && "border-destructive/50 bg-destructive/10",
                    st === "running" && "border-foreground/30",
                    (st === "pending" || st === "skipped") && "opacity-60",
                  )}
                >
                  <span className="mt-0.5 shrink-0">
                    {st === "pass" ? (
                      <CheckCircle2 className="size-4 text-primary" />
                    ) : st === "fail" ? (
                      <XCircle className="size-4 text-destructive" />
                    ) : st === "running" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <span className="block size-4 rounded-full border" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{c.label}</span>
                    <span className="block text-xs text-muted-foreground">{c.hop}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          {verdict && (
            <div
              className={cn(
                "mt-4 rounded-lg border p-4",
                verdict.ok
                  ? "border-primary/40 bg-primary/5"
                  : "border-destructive/50 bg-destructive/10",
              )}
            >
              <p className="flex items-center gap-2 text-sm font-semibold">
                {verdict.ok ? (
                  <>
                    <CheckCircle2 className="size-4 text-primary" /> Accepted
                  </>
                ) : (
                  <>
                    <XCircle className="size-4 text-destructive" /> Rejected
                  </>
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{verdict.reason}</p>
              {!verdict.ok && (
                <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                  With a shared API key instead of a mandate, nothing would have
                  stopped this — the key proves the agent can call the service, not
                  that it was allowed to do <em>this</em>, for <em>this person</em>,{" "}
                  <em>right now</em>.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          <h4 className="text-sm font-semibold text-foreground">What just happened</h4>
          <p className="mt-2">
            Alice never shared a password or a payment method. She signed one
            narrow statement — <em>this agent, this scope, this cap, until this
            time</em> — and the verifier could check it independently: maths on the
            signature, then plain rules on the claims. Every failure above is caught
            before the action happens, not reconciled afterwards.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{k}</span>
      <span className="min-w-0 break-words font-medium">{v}</span>
    </div>
  );
}
