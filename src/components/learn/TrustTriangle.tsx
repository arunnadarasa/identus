import { BadgeCheck, ShieldCheck, Wallet } from "lucide-react";

const nodes = [
  {
    role: "Issuer",
    example: "University, bank, government",
    icon: BadgeCheck,
  },
  {
    role: "Holder",
    example: "You, with a wallet on your phone",
    icon: Wallet,
  },
  {
    role: "Verifier",
    example: "Landlord, employer, door staff",
    icon: ShieldCheck,
  },
];

function Node({
  role,
  example,
  icon: Icon,
}: {
  role: string;
  example: string;
  icon: typeof Wallet;
}) {
  return (
    <div className="flex w-full max-w-[15rem] flex-col items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-4 py-4 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="font-display text-base font-semibold">{role}</span>
      <span className="text-xs text-muted-foreground">{example}</span>
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-1 sm:py-0">
      <span className="text-primary/70" aria-hidden="true">
        ↓
      </span>
      <span className="font-mono text-[11px] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function TrustTriangle() {
  return (
    <div className="rounded-lg border border-border/60 bg-card/30 p-5 sm:p-8">
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        The three roles
      </p>

      {/* Mobile: vertical flow */}
      <div className="mt-5 flex flex-col items-center gap-1 md:hidden">
        <Node {...nodes[0]!} />
        <Arrow label="issues a credential" />
        <Node {...nodes[1]!} />
        <Arrow label="presents a proof" />
        <Node {...nodes[2]!} />
        <div className="mt-3 rounded-md border border-dashed border-primary/40 px-3 py-2 text-center font-mono text-[11px] text-muted-foreground">
          verifier trusts the issuer's signature — no phone call needed
        </div>
      </div>

      {/* Desktop: triangle */}
      <div className="mt-6 hidden md:block">
        <div className="flex justify-center">
          <Node {...nodes[0]!} />
        </div>
        <div className="relative mx-auto mt-3 flex max-w-3xl items-start justify-between">
          <span className="absolute left-1/2 top-6 -translate-x-1/2 rounded-md border border-dashed border-primary/40 bg-background px-3 py-1 font-mono text-[11px] text-muted-foreground">
            trusts the issuer's signature
          </span>
          <div className="flex flex-col items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">
              ↙ issues a credential
            </span>
            <Node {...nodes[1]!} />
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">
              presents a proof ↘
            </span>
            <Node {...nodes[2]!} />
          </div>
        </div>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        An <span className="text-foreground">issuer</span> signs a credential and
        gives it to you. You are the{" "}
        <span className="text-foreground">holder</span> — it lives in your
        wallet. When a <span className="text-foreground">verifier</span> asks,
        you present a proof, and they check the issuer's signature with maths
        rather than a phone call.
      </p>
    </div>
  );
}
