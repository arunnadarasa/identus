import { Building2, Home, GraduationCap, Package } from "lucide-react";

const icons = [Home, GraduationCap, Building2, Package];
const times = ["09:00", "11:30", "14:00", "17:15"];

export function SsiTimeline({
  items,
}: {
  items: { step: string; title: string; body: string }[];
}) {
  return (
    <ol className="relative space-y-6 border-l border-border/60 pl-6 sm:pl-8">
      {items.map((d, i) => {
        const Icon = icons[i % icons.length]!;
        return (
          <li key={d.step} className="relative">
            <span className="absolute -left-[2.15rem] flex h-8 w-8 items-center justify-center rounded-full border border-primary/40 bg-background text-primary sm:-left-[2.65rem]">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="rounded-lg border border-border/60 bg-card/60 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-primary">
                  {times[i % times.length]}
                </span>
                <h3 className="font-display text-base font-semibold sm:text-lg">
                  {d.title}
                </h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{d.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
