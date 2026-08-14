const rows = [
  {
    problem: "Identity assurance",
    credential: "Patient identity credential",
    issuer: "NHS identity service",
    claims: ["NHS number", "Name", "Date of birth"],
    note: "Held in the person's wallet. Proves they are the subject of the record without re-doing document checks at every service.",
  },
  {
    problem: "Identity assurance",
    credential: "Professional role credential",
    issuer: "Regulator or employing trust",
    claims: ["Registration number", "Role", "Organisation", "Valid until"],
    note: "\"Registered pharmacist at a named organisation\" — checkable by anyone, revoked the day the role ends.",
  },
  {
    problem: "Authorisation",
    credential: "Care-relationship grant",
    issuer: "The patient (or a lawful delegate)",
    claims: ["Scope", "Purpose", "Expires at"],
    note: "Names the exact slice — for example medication history only — the purpose, and a window measured in hours, not forever.",
  },
  {
    problem: "Consent and audit",
    credential: "Presentation record",
    issuer: "Verifier, mirrored to the patient",
    claims: ["Who asked", "What was proven", "When"],
    note: "Every check leaves a signed trace the patient can read in plain language in the app.",
  },
  {
    problem: "Cross-organisation trust",
    credential: "Revocation status",
    issuer: "Original issuer",
    claims: ["Still valid?"],
    note: "Status is published and checked at verification time, so a withdrawn consent or a lapsed registration stops working everywhere at once.",
  },
];

export function CredentialMap() {
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div
          key={r.credential + r.problem}
          className="rounded-lg border border-border/60 bg-card/30 p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {r.problem}
            </span>
            <span className="font-display text-sm font-semibold tracking-tight">
              {r.credential}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Issued by <span className="text-foreground">{r.issuer}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {r.claims.map((c) => (
              <span
                key={c}
                className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-foreground"
              >
                {c}
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {r.note}
          </p>
        </div>
      ))}
    </div>
  );
}
