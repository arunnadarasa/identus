import { BadgeCheck, Bot, Fingerprint, ShieldCheck } from "lucide-react";

/**
 * The right half of the split-screen hero: a static, purely decorative rendering
 * of the three artifacts the console actually produces — a signed credential, a
 * zero-knowledge proof result and a delegation mandate. No live data, so it can
 * render during SSR without a session.
 */
export function HeroArtifact() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="animate-sheen absolute -inset-6 rounded-[2rem] bg-gradient-primary opacity-25 blur-2xl"
      />

      <div className="glass glow-ring relative rounded-2xl p-4 sm:p-5">
        {/* Credential */}
        <div className="rounded-xl bg-gradient-primary p-[1px] shadow-float">
          <div className="rounded-[0.7rem] bg-card/95 p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                JWT verifiable credential
              </span>
              <BadgeCheck className="h-4 w-4 text-success" />
            </div>
            <p className="mt-3 text-lg font-semibold">Student ID</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Holder</dt>
                <dd className="font-mono truncate text-foreground">did:prism:9f3c…a41d</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Issuer</dt>
                <dd className="font-mono truncate text-foreground">did:prism:1e77…b0c2</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Claim</dt>
                <dd className="text-foreground">dob 2003-05-12</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="text-success">Signed &amp; stored</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Proof + delegation */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-background/60 p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">ZK proof</span>
            </div>
            <p className="mt-2 font-mono text-[0.7rem] text-muted-foreground">over18 = true</p>
            <p className="font-mono text-[0.7rem] text-muted-foreground">dob disclosed = false</p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full bg-gradient-primary" />
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Delegation</span>
            </div>
            <p className="mt-2 text-[0.7rem] text-muted-foreground">
              Agent may spend up to <span className="font-mono text-foreground">5 USDC</span> at one
              merchant.
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-[0.65rem] text-muted-foreground">
              <Fingerprint className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono">mandate verified</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
