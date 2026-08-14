import { User, Smartphone, Network } from "lucide-react";

const pillars = [
  {
    icon: User,
    title: "One record per person",
    body: "Information that today sits in separate GP, hospital, pharmacy and community systems is brought together into a single view of the person, rather than a stack of disconnected episodes.",
  },
  {
    icon: Smartphone,
    title: "Visible to the patient",
    body: "The person can see their own record through the NHS App — the same information their care team works from, not a cut-down summary they have to request.",
  },
  {
    icon: Network,
    title: "Shared across care settings",
    body: "A clinician in urgent care, a community pharmacist or a district nurse can see the relevant history at the point of care, instead of re-asking the patient or waiting on a letter.",
  },
];

export function SprPillars() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {pillars.map((p) => (
        <div
          key={p.title}
          className="rounded-lg border border-border/60 bg-card/30 p-5"
        >
          <p.icon className="h-5 w-5 text-primary" aria-hidden="true" />
          <h3 className="font-display mt-3 text-base font-semibold tracking-tight">
            {p.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {p.body}
          </p>
        </div>
      ))}
    </div>
  );
}
