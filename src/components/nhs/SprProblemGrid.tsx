const problems = [
  {
    n: "01",
    title: "Identity assurance",
    question: "Is this really the patient — and really a clinician?",
    body: "A single record is only as safe as the answer to \"who is at the keyboard\". Patients need a way to prove they are the subject of the record without handing over a folder of documents; staff need to prove they are a registered professional, not just that they hold a valid login to some system.",
  },
  {
    n: "02",
    title: "Authorisation, not just access",
    question: "Which slice of the record, for how long?",
    body: "An out-of-hours pharmacist checking an interaction does not need a lifetime of mental health notes. \"Logged in\" is a blunt instrument; what is needed is a scoped, time-bounded permission that names the purpose and expires on its own.",
  },
  {
    n: "03",
    title: "Consent and audit the patient can see",
    question: "Would the person recognise what happened to their record?",
    body: "Trust in a single record depends on the patient being able to see who looked, why, and under what permission — and being able to withdraw a permission they granted, with that withdrawal taking effect rather than being filed as a request.",
  },
  {
    n: "04",
    title: "Trust across organisations",
    question: "Who vouches for the other side?",
    body: "Care crosses trusts, GP federations, pharmacy chains, social care and private providers. Building one central table of every professional, role and consent creates a single point of failure. The alternative is proofs each organisation issues and anyone can verify.",
  },
];

export function SprProblemGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {problems.map((p) => (
        <div
          key={p.n}
          className="rounded-lg border border-border/60 bg-card/30 p-5"
        >
          <p className="font-mono text-[11px] uppercase tracking-wider text-primary">
            {p.n}
          </p>
          <h3 className="font-display mt-2 text-base font-semibold tracking-tight">
            {p.title}
          </h3>
          <p className="mt-1 text-sm italic text-foreground/80">{p.question}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {p.body}
          </p>
        </div>
      ))}
    </div>
  );
}
