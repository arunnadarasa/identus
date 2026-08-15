import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BadgeCheck,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TruncatedMono, shortenId } from "@/components/MonoValue";
import { listZkCredentials, recordZkPresentation } from "@/lib/zk.functions";
import { extractBirthYear } from "@/lib/zk-claims";
import {
  AGE_CIRCUIT_NARGO_TOML,
  AGE_CIRCUIT_SOURCE,
  credentialBinding,
} from "./zk-circuit";

/**
 * noir_wasm's published browser bundle is served verbatim from this URL by the
 * `noir-wasm-vendor-asset` plugin in vite.config.ts — see the comment there for
 * why it must not go through the bundler.
 */
const NOIR_WASM_URL = "/vendor/noir_wasm/main.mjs";

/** Binding used when no credential is selected — a self-declared, unsigned run. */
const MANUAL_BINDING_SOURCE = "manual-entry:no-credential";

type StepState = "pending" | "running" | "done" | "failed";
type Step = { key: string; label: string; state: StepState; detail?: string | undefined };

/**
 * Wall-clock budgets. The prover and its wasm assets are several megabytes, so
 * a slow or blocked network otherwise leaves the panel spinning forever.
 */
const TIMEOUTS = {
  /** Download + instantiate noir_wasm, noir_js and Barretenberg, then compile. */
  load: 90_000,
  /** Witness generation is pure compute and quick, but bound it anyway. */
  witness: 30_000,
  /** UltraHonk proving on a slow phone. */
  prove: 180_000,
  verify: 60_000,
} as const;

class StageTimeoutError extends Error {
  constructor(readonly stage: string, readonly ms: number) {
    super(`${stage} timed out after ${Math.round(ms / 1000)}s`);
    this.name = "StageTimeoutError";
  }
}

/** Rejects with a StageTimeoutError when `work` outlives `ms`. */
async function withTimeout<T>(stage: string, ms: number, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new StageTimeoutError(stage, ms)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Bytes actually pulled over the network for the prover assets. */
type LoadProgress = { bytes: number; assets: number; phase: string };

const ASSET_PATTERN = /\.wasm|noir|bb\.js|barretenberg|acvm/i;

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${bytes} B`;
}

/**
 * The Noir/Barretenberg loaders fetch their own wasm internally, so the only
 * honest way to report download progress is to watch the resource timeline and
 * sum the bytes the browser reports for those requests.
 */
function observeAssetDownloads(onBytes: (bytes: number, assets: number) => void) {
  if (typeof PerformanceObserver === "undefined") return () => {};
  const seen = new Map<string, number>();
  const publish = () => {
    let total = 0;
    for (const size of seen.values()) total += size;
    onBytes(total, seen.size);
  };
  const ingest = (entries: PerformanceEntryList) => {
    let changed = false;
    for (const entry of entries) {
      const e = entry as PerformanceResourceTiming;
      if (!ASSET_PATTERN.test(e.name)) continue;
      const size = e.encodedBodySize || e.transferSize || e.decodedBodySize || 0;
      if (!size) continue;
      const prev = seen.get(e.name);
      if (prev === size) continue;
      seen.set(e.name, size);
      changed = true;
    }
    if (changed) publish();
  };
  const observer = new PerformanceObserver((list) => ingest(list.getEntries()));
  try {
    observer.observe({ type: "resource", buffered: true });
  } catch {
    return () => {};
  }
  return () => observer.disconnect();
}

type ProofResult = {
  proofHex: string;
  proofBytes: Uint8Array;
  publicInputs: string[];
  commitment: string;
  fields: number;
  ms: number;
  credentialId: string | null;
  bindingMatches: boolean | null;
};

const STEPS: { key: string; label: string }[] = [
  { key: "load", label: "Download the compiler and UltraHonk prover (wasm)" },
  { key: "compile", label: "Compile the Noir circuit" },
  { key: "bind", label: "Derive the credential binding (SHA-256 of the JWT)" },
  { key: "witness", label: "Execute circuit, compute witness" },
  { key: "prove", label: "Generate the proof (UltraHonk)" },
  { key: "verify", label: "Verify the proof" },
];

function toHex(bytes: Uint8Array) {
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** Compiled artefacts and the wasm backend are expensive — build once, reuse. */
type Session = {
  program: unknown;
  noir: {
    execute: (
      inputs: Record<string, string | number>,
    ) => Promise<{ witness: Uint8Array; returnValue: unknown }>;
  };
  backend: {
    generateProof: (w: Uint8Array) => Promise<{ proof: Uint8Array; publicInputs: string[] }>;
    verifyProof: (p: { proof: Uint8Array; publicInputs: string[] }) => Promise<boolean>;
  };
};

export default function ZkProofLive() {
  const currentYear = new Date().getUTCFullYear();
  const thresholdYear = currentYear - 18;

  const fetchCredentials = useServerFn(listZkCredentials);
  const record = useServerFn(recordZkPresentation);
  const credentialsQuery = useQuery({
    queryKey: ["zk-credentials"],
    queryFn: () => fetchCredentials(),
  });

  const credentials = credentialsQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string>("manual");
  const [dobYear, setDobYear] = useState(String(currentYear - 31));
  const [steps, setSteps] = useState<Step[]>(() => STEPS.map((s) => ({ ...s, state: "pending" })));
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<ProofResult | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [tampered, setTampered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedStage, setFailedStage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [loaded, setLoaded] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const stopObservingRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopObservingRef.current?.(), []);

  const selected = useMemo(
    () => credentials.find((c) => c.id === selectedId) ?? null,
    [credentials, selectedId],
  );
  const selectedYear = useMemo(
    () => (selected ? extractBirthYear(selected.claims) : { year: null, claimKey: null }),
    [selected],
  );

  // A credential-backed run must use the year the issuer attested to, not a typed one.
  useEffect(() => {
    if (selected && selectedYear.year) setDobYear(String(selectedYear.year));
  }, [selected, selectedYear.year]);

  const locked = Boolean(selected && selectedYear.year);
  const dobNumber = Number(dobYear);
  const dobValid = Number.isInteger(dobNumber) && dobNumber >= 1900 && dobNumber <= currentYear;
  const wouldPass = useMemo(
    () => dobValid && dobNumber <= thresholdYear,
    [dobValid, dobNumber, thresholdYear],
  );
  const blocked = Boolean(selected && !selectedYear.year);

  const setStep = useCallback((key: string, state: StepState, detail?: string) => {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, state, detail } : s)));
  }, []);

  const getSession = useCallback(
    async (onPhase: (phase: string) => void) => {
      if (sessionRef.current) return sessionRef.current;

      // Imported inside the handler so the multi-megabyte wasm bundles are only
      // fetched when a visitor actually asks for a proof.
      // noir_wasm is fetched from a stable vendor URL with a runtime `import()`
      // so the production bundler never rewrites it. Rolldown mis-renames the
      // shadowed globals in the `@ltd/j-toml` module inside noir_wasm's own
      // webpack bundle, emitting `const Infinity = Infinity`, which throws
      // "Cannot access 'Infinity' before initialization" (minified: "Cannot
      // access 'j' ...") the moment the compiler is imported.
      onPhase("fetching modules");
      const [noirWasm, { Noir }, bb] = await Promise.all([
        (import(/* @vite-ignore */ NOIR_WASM_URL) as Promise<{
          compile: (fm: unknown) => Promise<unknown>;
          createFileManager: (root: string) => {
            writeFile: (path: string, stream: ReadableStream) => Promise<void>;
          };
        }>).catch((e: unknown) => {
          throw new Error(
            `The Noir compiler could not be loaded from ${NOIR_WASM_URL}: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        }),
        import("@noir-lang/noir_js"),
        import("@aztec/bb.js").catch((e: unknown) => {
          throw new Error(
            `The UltraHonk prover (bb.js) could not be loaded: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        }),
      ]);
      const { compile, createFileManager } = noirWasm;

      onPhase("compiling circuit");
      const fm = createFileManager("/");
      await fm.writeFile("./src/main.nr", new Blob([AGE_CIRCUIT_SOURCE]).stream());
      await fm.writeFile("./Nargo.toml", new Blob([AGE_CIRCUIT_NARGO_TOML]).stream());
      const compiled = (await compile(fm)) as
        | { program: { bytecode: string } }
        | { bytecode: string };
      const program = "program" in compiled ? compiled.program : compiled;

      // threads: 1 keeps this working without cross-origin isolation headers.
      onPhase("starting the prover backend");
      const api = await bb.Barretenberg.new({ threads: 1 });
      const backend = new bb.UltraHonkBackend(program.bytecode, api);

      const session = {
        program,
        noir: new Noir(program as never) as unknown as Session["noir"],
        backend: backend as unknown as Session["backend"],
      };
      sessionRef.current = session;
      return session;
    },
    [],
  );


  async function handleProve() {
    if (!dobValid || blocked || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setVerified(null);
    setTampered(false);
    setSaved(false);
    setSteps(STEPS.map((s) => ({ ...s, state: "pending" })));

    const started = performance.now();
    try {
      setStep("compile", "running");
      const session = await getSession();
      setStep("compile", "done", "acir bytecode ready");

      setStep("bind", "running");
      const binding = await credentialBinding(selected ? selected.jwt : MANUAL_BINDING_SOURCE);
      setStep(
        "bind",
        "done",
        selected
          ? `sha256(jwt) = ${shortenId(binding.digest, 10, 6)}`
          : "manual entry — binding is not credential-backed",
      );

      setStep("witness", "running");
      let witness: Uint8Array;
      let returnValue: unknown;
      try {
        const executed = await session.noir.execute({
          dob_year: dobNumber,
          credential_hash_lo: binding.lo,
          credential_hash_hi: binding.hi,
          threshold_year: thresholdYear,
        });
        witness = executed.witness;
        returnValue = executed.returnValue;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setStep("witness", "failed", msg);
        throw new Error(
          `The circuit's assertion cannot be satisfied, so no proof exists: ${msg}`,
        );
      }
      setStep("witness", "done", "constraints satisfied");

      setStep("prove", "running");
      const proof = await session.backend.generateProof(witness);
      const ms = Math.round(performance.now() - started);
      setStep("prove", "done", `${proof.proof.length} bytes`);

      const commitment = String(returnValue ?? proof.publicInputs.at(-1) ?? "");
      const bindingMatches = selected?.lastCommitment
        ? selected.lastCommitment === commitment
        : null;
      const proofResult: ProofResult = {
        proofBytes: proof.proof,
        proofHex: toHex(proof.proof),
        publicInputs: proof.publicInputs,
        commitment,
        fields: Math.round(proof.proof.length / 32),
        ms,
        credentialId: selected?.id ?? null,
        bindingMatches,
      };
      setResult(proofResult);

      setStep("verify", "running");
      const ok = await session.backend.verifyProof(proof);
      setVerified(ok);
      setStep("verify", ok ? "done" : "failed", ok ? "proof accepted" : "proof rejected");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleTamper() {
    const session = sessionRef.current;
    if (!session || !result || busy) return;
    setBusy(true);
    setError(null);
    try {
      const mutated = new Uint8Array(result.proofBytes);
      const index = Math.min(64, mutated.length - 1);
      mutated[index] = (mutated[index] ?? 0) ^ 0x01;
      setStep("verify", "running", "re-verifying a modified proof");
      let ok = false;
      try {
        ok = await session.backend.verifyProof({
          proof: mutated,
          publicInputs: result.publicInputs,
        });
      } catch {
        ok = false;
      }
      setTampered(true);
      setVerified(ok);
      setStep("verify", ok ? "done" : "failed", ok ? "accepted" : "rejected — one flipped byte");
    } finally {
      setBusy(false);
    }
  }

  async function handleRecord() {
    if (!result || !result.credentialId || verified !== true || tampered) return;
    setSaving(true);
    try {
      await record({
        data: {
          credentialId: result.credentialId,
          commitment: result.commitment,
          thresholdYear,
          publicInputs: result.publicInputs,
          proofBytes: result.proofBytes.length,
          fields: result.fields,
          ms: result.ms,
          verified: true,
          circuit: AGE_CIRCUIT_SOURCE,
        },
      });
      setSaved(true);
      toast.success("Recorded as a presentation against the credential");
      void credentialsQuery.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record the presentation");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-card/40 p-4 sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h3 className="font-mono text-sm font-medium text-primary">
            Prove I'm over 18 — from an issued credential
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a credential this console issued. Its birth year becomes the private
            input, and the proof is bound to the credential's JWT with{" "}
            <a
              href="https://noir-lang.org/docs"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline decoration-dotted"
            >
              Noir
            </a>{" "}
            and the Barretenberg UltraHonk prover. Nothing is sent to a server while
            proving.
          </p>
        </div>
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      </div>

      <div className="mt-5 space-y-2">
        <Label htmlFor="zk-credential" className="text-xs">
          Credential (source of the private birth year)
        </Label>
        <select
          id="zk-credential"
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setResult(null);
            setVerified(null);
            setSaved(false);
            setSteps(STEPS.map((s) => ({ ...s, state: "pending" })));
          }}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="manual">Manual entry — no credential</option>
          {credentials.map((c) => (
            <option key={c.id} value={c.id}>
              {c.schemaName ?? "Credential"} · {c.subject ?? shortenId(c.id)}
            </option>
          ))}
        </select>
        {credentialsQuery.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading your credentials…</p>
        ) : credentials.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No accepted credentials yet — issue and accept one on the Credentials page to
            bind a proof to it.
          </p>
        ) : null}
        {selected ? (
          <div className="grid gap-1 rounded-md border border-border/60 bg-background/60 p-3 text-xs">
            <p className="text-muted-foreground">
              Issuer <span className="font-mono text-foreground/80">{shortenId(selected.issuerDid ?? "—", 12, 6)}</span>
            </p>
            <p className="text-muted-foreground">
              Schema <span className="text-foreground/80">{selected.schemaName ?? "—"}</span>
              {selectedYear.claimKey ? (
                <>
                  {" · claim "}
                  <span className="font-mono text-foreground/80">{selectedYear.claimKey}</span>
                </>
              ) : null}
            </p>
            {blocked ? (
              <p className="text-destructive">
                This credential carries no date-of-birth claim, so there is nothing to prove
                about an age threshold. Issue one with a <span className="font-mono">dob</span>{" "}
                claim on the Credentials page.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <pre className="mt-4 overflow-x-auto rounded-md border border-border/60 bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {AGE_CIRCUIT_SOURCE}
      </pre>
      <p className="mt-2 text-xs text-muted-foreground">
        <span className="text-foreground/80">dob_year</span> and the two{" "}
        <span className="text-foreground/80">credential_hash</span> halves are private — they
        never leave the prover. <span className="text-foreground/80">threshold_year</span> and
        the returned commitment are public, so a verifier can tell which credential the proof
        is about without seeing the credential or the year.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          <Label htmlFor="zk-dob" className="text-xs">
            Birth year (private input)
          </Label>
          <Input
            id="zk-dob"
            inputMode="numeric"
            value={dobYear}
            readOnly={locked}
            onChange={(e) => setDobYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            {locked ? "Read from the credential's claims. " : null}
            Threshold for 18+ in {currentYear}:{" "}
            <span className="font-mono text-foreground/80">{thresholdYear}</span>
            {dobValid ? (
              wouldPass ? null : (
                <span className="text-destructive"> — under 18, so no proof can exist</span>
              )
            ) : (
              <span className="text-destructive"> — enter a year between 1900 and {currentYear}</span>
            )}
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">What the verifier learns</Label>
          <div className="rounded-md border border-border/60 bg-background/60 p-3 text-xs">
            {verified === true && !tampered && result ? (
              <div className="space-y-1 font-mono text-muted-foreground">
                <p className="text-primary">over_18 = true</p>
                <p>threshold_year = {thresholdYear}</p>
                <p className="break-all">
                  credential_commitment = {shortenId(result.commitment, 12, 8)}
                </p>
                <p className="text-muted-foreground/70">dob_year = (never revealed)</p>
                <p className="text-muted-foreground/70">credential_jwt = (never revealed)</p>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Nothing yet — generate a proof to see the public output.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={handleProve}
          disabled={busy || !dobValid || blocked}
          className="w-full sm:w-auto"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Working…
            </>
          ) : (
            "Generate proof"
          )}
        </Button>
        <Button
          variant="outline"
          onClick={handleTamper}
          disabled={busy || !result}
          className="w-full sm:w-auto"
        >
          <ShieldAlert className="mr-2 h-4 w-4" />
          Tamper with the proof
        </Button>
        {result?.credentialId ? (
          <Button
            variant="outline"
            onClick={handleRecord}
            disabled={saving || saved || verified !== true || tampered}
            className="w-full sm:w-auto"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <BadgeCheck className="mr-2 h-4 w-4" />
            )}
            {saved ? "Recorded" : "Record as presentation"}
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        The first proof downloads the prover and its reference string, so it can take 10–30 seconds.
        Later proofs are much faster.
      </p>

      <ol className="mt-5 space-y-2">
        {steps.map((s) => (
          <li key={s.key} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-sm">
            <span className="mt-0.5 shrink-0">
              {s.state === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : s.state === "done" ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : s.state === "failed" ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : (
                <span className="block h-4 w-4 rounded-full border border-border/60" />
              )}
            </span>
            <span className="min-w-0">
              <span
                className={
                  s.state === "pending" ? "text-muted-foreground" : "text-foreground/90"
                }
              >
                {s.label}
              </span>
              {s.detail ? (
                <span className="block break-words font-mono text-xs text-muted-foreground">
                  {s.detail}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>

      {error ? (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-5 space-y-3 rounded-md border border-border/60 bg-background/60 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {verified === true ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                Verified
              </span>
            ) : verified === false ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs text-foreground">
                <XCircle className="h-3.5 w-3.5 text-destructive" />
                {tampered ? "Rejected — proof was modified" : "Rejected"}
              </span>
            ) : null}
            {result.bindingMatches === true ? (
              <Badge variant="outline" className="border-primary/40 text-primary">
                Binding matches earlier presentation
              </Badge>
            ) : result.bindingMatches === false ? (
              <Badge variant="outline" className="border-destructive/40 text-destructive">
                Binding differs from earlier presentation
              </Badge>
            ) : null}
            <span className="font-mono text-xs text-muted-foreground">
              {result.fields} field elements · {result.proofBytes.length} bytes · {result.ms} ms
            </span>
          </div>

          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Public inputs
            </p>
            <div className="mt-1 space-y-1">
              {result.publicInputs.map((p) => (
                <p key={p} className="break-all font-mono text-[11px] text-foreground/80">
                  {p}{" "}
                  <span className="text-muted-foreground">= {BigInt(p).toString()}</span>
                </p>
              ))}
            </div>
          </div>

          <TruncatedMono value={result.proofHex} label="Proof (hex)" />
        </div>
      ) : null}
    </div>
  );
}
