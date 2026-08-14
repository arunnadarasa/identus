const fields = ["Name", "Address", "Date of birth", "Photo", "Over 18?"];

function Row({
  label,
  shared,
  tone,
}: {
  label: string;
  shared: string[];
  tone: "today" | "ssi";
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
    </div>
  );
}

export function DisclosureChips() {
  return (
    <div className="rounded-lg border border-border/60 bg-card/30 p-4 sm:p-6">
      <p className="text-sm text-muted-foreground">
        Example: proving your age at a venue. Same question, very different
        amount of you handed over.
      </p>
      <div className="mt-5 space-y-5">
        <Row
          label="Today — you show your licence"
          shared={fields}
          tone="today"
        />
        <Row label="With SSI — you show one fact" shared={["Over 18?"]} tone="ssi" />
      </div>
    </div>
  );
}
