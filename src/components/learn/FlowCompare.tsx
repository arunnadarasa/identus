const todayFlow = [
  "You upload your passport",
  "The platform stores a copy",
  "Every service repeats the check",
  "One breach exposes all of it",
];

const ssiFlow = [
  "You receive a signed credential",
  "It stays in your wallet",
  "You present only the fact needed",
  "Nobody stores a copy to leak",
];

function Flow({
  label,
  steps,
  tone,
}: {
  label: string;
  steps: string[];
  tone: "today" | "ssi";
}) {
  const accent =
    tone === "today"
      ? "border-destructive/40 text-destructive"
      : "border-primary/40 text-primary";
  const chip =
    tone === "today"
      ? "border-destructive/30 bg-destructive/5"
      : "border-primary/30 bg-primary/5";

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4 sm:p-5">
      <span
        className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${accent}`}
      >
        {label}
      </span>
      <ol className="mt-4 space-y-1">
        {steps.map((s, i) => (
          <li key={s}>
            <div
              className={`rounded-md border px-3 py-2 text-sm text-foreground ${chip}`}
            >
              {s}
            </div>
            {i < steps.length - 1 && (
              <div
                className="py-0.5 text-center text-xs text-muted-foreground"
                aria-hidden="true"
              >
                ↓
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function FlowCompare() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Flow label="How it works today" steps={todayFlow} tone="today" />
      <Flow label="How it works with SSI" steps={ssiFlow} tone="ssi" />
    </div>
  );
}
