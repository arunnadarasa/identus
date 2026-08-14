const fields = [
  "Full record",
  "Diagnoses",
  "Mental health notes",
  "Current medications",
  "Allergies",
];

function Row({
  label,
  shared,
  tone,
  caption,
}: {
  label: string;
  shared: string[];
  tone: "today" | "ssi";
  caption: string;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {fields.map((f) => {
          const on = shared.includes(f);
          const cls = on
            ? tone === "today"
              ? "border-destructive/40 bg-destructive/10 text-foreground"
              : "border-primary/40 bg-primary/10 text-foreground"
            : "border-border/60 bg-muted/30 text-muted-foreground line-through";
          return (
            <span
              key={f}
              className={`rounded-full border px-2.5 py-1 text-xs ${cls}`}
            >
              {f}
            </span>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}

export function DisclosureCompare() {
  return (
    <div className="rounded-lg border border-border/60 bg-card/30 p-4 sm:p-6">
      <p className="text-sm text-muted-foreground">
        Same clinical question — "is this safe to dispense?" — answered two
        different ways.
      </p>
      <div className="mt-5 space-y-6">
        <Row
          label="Access-based — open the record"
          shared={fields}
          tone="today"
          caption="Whoever is logged in can see far more than the question needed, and the patient finds out afterwards, if at all."
        />
        <Row
          label="Proof-based — answer the question"
          shared={["Current medications", "Allergies"]}
          tone="ssi"
          caption="Two fields, a stated purpose, an expiry, and an audit entry the patient can read."
        />
      </div>
      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        The same pattern answers questions without releasing any record at all:
        "is this person over 18?", "are they exempt from prescription charges?",
        "are they on this care pathway?" — each provable as a single yes,
        without disclosing the underlying data.
      </p>
    </div>
  );
}
