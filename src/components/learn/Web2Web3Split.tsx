import { Globe, Link2, Wallet } from "lucide-react";

const web2 = ["Logins without passwords", "KYC that gets reused", "HR & education checks"];
const web3 = ["Wallet-native identity", "DAO membership", "Portable reputation"];

function Column({
  label,
  icon: Icon,
  items,
}: {
  label: string;
  icon: typeof Globe;
  items: string[];
}) {
  return (
    <div className="flex-1 rounded-lg border border-border/60 bg-card/50 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="font-display text-base font-semibold">{label}</span>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        {items.map((i) => (
          <li key={i}>· {i}</li>
        ))}
      </ul>
    </div>
  );
}

export function Web2Web3Split() {
  return (
    <div className="rounded-lg border border-border/60 bg-card/20 p-4 sm:p-6">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <Column label="Web2" icon={Globe} items={web2} />
        <div className="flex shrink-0 flex-col items-center gap-2 px-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-primary">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-center font-mono text-[11px] text-muted-foreground">
            one credential,
            <br />
            both worlds
          </span>
          <Link2 className="h-4 w-4 text-primary/60" aria-hidden="true" />
        </div>
        <Column label="Web3" icon={Link2} items={web3} />
      </div>
    </div>
  );
}
