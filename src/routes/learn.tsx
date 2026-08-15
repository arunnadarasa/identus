import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketingHeader } from "@/components/MarketingHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Wallet, EyeOff, ShieldCheck, HelpCircle, Bot } from "lucide-react";
import { TrustTriangle } from "@/components/learn/TrustTriangle";
import { FlowCompare } from "@/components/learn/FlowCompare";
import { DisclosureChips } from "@/components/learn/DisclosureChips";
import { SsiTimeline } from "@/components/learn/SsiTimeline";
import { Web2Web3Split } from "@/components/learn/Web2Web3Split";
import { CredentialDemo } from "@/components/learn/CredentialDemo";
import { AgenticStack } from "@/components/learn/AgenticStack";
import { DelegationWalkthrough } from "@/components/learn/DelegationWalkthrough";
import { DelegationDemo } from "@/components/learn/DelegationDemo";
import { AgenticUseCases } from "@/components/learn/AgenticUseCases";
import { ZkProof } from "@/components/learn/ZkProof";

const sectionNav = [
  { id: "problem", label: "The problem" },
  { id: "pillars", label: "Three ideas" },
  { id: "demo", label: "Try it" },
  { id: "day", label: "A day with SSI" },
  { id: "web2", label: "Web2" },
  { id: "web3", label: "Web3" },
  { id: "zk", label: "Zero-knowledge" },
  { id: "agents", label: "AI agents" },
  { id: "agents-demo", label: "Delegation demo" },
  { id: "agents-faq", label: "Agent FAQ" },
  { id: "faq", label: "FAQ" },
];

const faqGroups: { heading: string; items: { q: string; a: string }[] }[] = [
  {
    heading: "DIDs",
    items: [
      {
        q: "What is a DID?",
        a: "A DID (Decentralised Identifier) is a unique identifier you create and control yourself — like a web address for your identity that no company can take away or change.",
      },
      {
        q: "Is a DID like a username?",
        a: "Not quite. A username only works inside one app and someone else owns it. A DID is yours, works across any service that supports it, and proves who you are with cryptography instead of a password.",
      },
      {
        q: "Where does a DID live?",
        a: "Your DID lives in a wallet you control — on your phone, laptop, or a cloud you chose. The proof that it is real is published openly so anyone can check it, but the keys that control it stay with you.",
      },
      {
        q: "What does 'published' mean?",
        a: "Publishing a DID means recording its public keys on a shared ledger (like the PRISM blockchain) so others can look it up and confirm it is genuine. It does not reveal your personal data — only the cryptographic proof.",
      },
      {
        q: "Can I have more than one DID?",
        a: "Yes. You can keep separate DIDs for work, banking, and social life, so they cannot be linked back to each other. Think of them as different keys for different doors.",
      },
    ],
  },
  {
    heading: "Credentials",
    items: [
      {
        q: "What is a verifiable credential?",
        a: "It is a digital version of a document — a degree, a licence, a membership — that comes with a cryptographic signature so anyone can confirm it was really issued by the organisation it claims to be from.",
      },
      {
        q: "Who issues them?",
        a: "Any organisation or person with a published DID can issue credentials: universities, employers, governments, banks. In this app you act as the issuer and create them yourself.",
      },
      {
        q: "Where are they stored?",
        a: "Inside your wallet, alongside your DIDs. They are not stored on the issuer's servers or on a public blockchain — only you hold them, and only you decide when to show them.",
      },
      {
        q: "Can they expire or be revoked?",
        a: "Yes. A credential can have an expiry date, and an issuer can revoke it if it should no longer be valid (say, a suspended licence). Verification checks for both.",
      },
      {
        q: "Are they stored on a blockchain?",
        a: "No. Only the DID and its public keys are published on the ledger. The credential itself, with its personal details, stays in your wallet and is shared only when you choose.",
      },
    ],
  },
  {
    heading: "Verification",
    items: [
      {
        q: "How does someone check a credential?",
        a: "A verifier asks your wallet for a proof. Your wallet sends a cryptographic presentation built from the credential. The verifier checks the signature against the issuer's published DID and confirms it is genuine.",
      },
      {
        q: "Do they call the issuer?",
        a: "No. That is the whole point. Because the credential is signed and the keys are published, a verifier can confirm it independently — no phone call, no database lookup, no middleman.",
      },
      {
        q: "What can a verifier see?",
        a: "Only what you choose to share. You can prove you are over 18 without showing your birthdate, or prove you have a degree without revealing your grades. This is called selective disclosure.",
      },
      {
        q: "Can a credential be faked?",
        a: "Not without the issuer's private key, which never leaves the issuer. A forged credential will fail the signature check, so the verifier knows instantly it is not genuine.",
      },
      {
        q: "Does verification need the internet?",
        a: "The verifier needs to reach the ledger once to look up the issuer's published keys. After that the cryptography does the rest — it does not need to contact you, the issuer, or any central service.",
      },
    ],
  },
];

const agentFaqGroups: { heading: string; items: { q: string; a: string }[] }[] = [
  {
    heading: "Delegation",
    items: [
      {
        q: "What does it mean for an agent to act on my behalf?",
        a: "You give the agent a delegation credential — a signed note from your DID that says 'this agent may act for me, for these purposes, until this time.' The agent presents that note when it deals with another service, which checks your signature rather than phoning you.",
      },
      {
        q: "How does an agent prove it's allowed?",
        a: "It shows the delegation credential, signed by your DID, alongside whatever it's doing. Because your DID is published, the other side can confirm your signature is genuine — no central registry, no phone call to you.",
      },
      {
        q: "Can I limit what an agent can do?",
        a: "Yes. The delegation can name exact scopes — 'book a flight up to £300', 'read but not move funds', 'valid for 24 hours'. Anything outside those scopes fails verification, so the other side refuses it.",
      },
      {
        q: "Can I revoke a delegation?",
        a: "Yes. You publish a revocation against your DID, and verifiers check for it. The agent's credential may still look valid, but the revocation check fails — so it stops working the moment you revoke, without collecting the credential back.",
      },
      {
        q: "What stops an agent overstepping?",
        a: "Two things. The scopes you set in the delegation cap it, and every verifier checks both the signature and those scopes before acting. An agent can ask for more, but a well-behaved verifier will refuse anything the delegation doesn't cover.",
      },
    ],
  },
  {
    heading: "Selective disclosure",
    items: [
      {
        q: "How does an agent share only what's needed?",
        a: "When a verifier asks for a claim, the agent builds a presentation that includes only the relevant fields — 'over 18' rather than a full birthdate. The presentation is still signed, so the verifier can trust it without seeing the underlying document.",
      },
      {
        q: "Can an agent reveal more than I allowed?",
        a: "Not if the verifier is checking properly. The presentation only carries what the agent chooses to put in it, and the verifier should reject fields outside what the delegation permits. You set the policy in the delegation; the agent can only present within it.",
      },
      {
        q: "What about zero-knowledge proofs?",
        a: "A ZK proof goes further — it proves a fact ('I'm over 18') without revealing the value behind it, or even which credential it came from. The live demo on this page generates and verifies a real one in your browser. ZK is stronger privacy but needs a compatible verifier.",
      },
      {
        q: "Does selective disclosure work across services?",
        a: "Yes, as long as both sides speak the same credential format. A presentation built from one issuer's credential can be checked by any verifier that trusts that issuer — the wallet and the agent handle the plumbing.",
      },
      {
        q: "Does the agent keep a copy of my credentials?",
        a: "That depends on your setup. You can hold the credentials and have the agent request presentations on demand, or you can store them with the agent. Either way, the agent can only present what the delegation allows — it can't widen the disclosure on its own.",
      },
    ],
  },
  {
    heading: "Verification",
    items: [
      {
        q: "How does a verifier know an agent is legitimate?",
        a: "It checks the delegation credential's signature against your published DID, confirms the scopes cover what the agent is asking to do, and checks the delegation hasn't been revoked or expired. If all three pass, the agent is acting within its mandate.",
      },
      {
        q: "Does the verifier need to trust me or the agent?",
        a: "The verifier trusts your DID — that is, the published keys that prove a delegation really came from you. It doesn't need to trust the agent's word, and it doesn't need a separate relationship with you. The cryptography stands in for that trust.",
      },
      {
        q: "What if the agent is offline?",
        a: "A delegation is checked at the moment it's presented, so the agent only needs to be reachable while it's acting. If it's down, it simply can't initiate anything — there's no background trust that decays. Revoke the delegation if it should stop permanently.",
      },
      {
        q: "Can verification be automated by another agent?",
        a: "Yes — that's the point of agent-to-agent flows. The verifier can be another agent that runs the same checks: signature, scopes, revocation, expiry. Each side proves its mandate; neither needs a human in the loop for routine decisions.",
      },
      {
        q: "What fails if delegation isn't used?",
        a: "Without delegation, the verifier has no way to confirm the agent is acting for you rather than itself. It either has to trust the agent blindly (unsafe) or fall back to you handling the interaction directly (slow). Delegation is what makes autonomous agents trustworthy.",
      },
    ],
  },
];

const pillarIcons = [Wallet, EyeOff, ShieldCheck];


export const Route = createFileRoute("/learn")({
  head: () => ({
    meta: [
      {
        title: "What is self-sovereign identity? — Identus Companion",
      },
      {
        name: "description",
        content:
          "A plain-English guide to self-sovereign identity (SSI): what it is, why it matters, and the opportunity it creates for web2 and web3 — no technical background required.",
      },
      {
        property: "og:title",
        content: "What is self-sovereign identity? — Identus Companion",
      },
      {
        property: "og:description",
        content:
          "Understand SSI in plain English and the opportunity it creates for web2 and web3.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Learn,
});

const problems = [
  {
    title: "Passwords everywhere",
    body: "Every app asks you to invent a password, remember it, and reset it when you forget. You reuse the same few, or hand them to a password manager that becomes a single point of failure.",
  },
  {
    title: "You don't own your data",
    body: "Your driving licence, degree, and bank details live inside someone else's database. You can't move them, and you can't take them back when you leave.",
  },
  {
    title: "Breaches are inevitable",
    body: "Because every service keeps a copy of your identity, one breach at one company is enough to expose you. The more copies exist, the bigger the blast radius.",
  },
];

const pillars = [
  {
    title: "You hold it",
    body: "Your credentials live in a digital wallet you control — on your phone, your laptop, or a cloud you chose. Not in a company's database.",
    tag: "Ownership",
  },
  {
    title: "You prove it",
    body: "Show only what's needed. Prove you're over 18 without revealing your birthdate. Prove you have a degree without handing over the transcript.",
    tag: "Privacy",
  },
  {
    title: "Anyone can verify",
    body: "A checker confirms the credential is genuine using cryptography — without calling the issuer, and without seeing anything you didn't choose to share.",
    tag: "Trust",
  },
];

const beforeAfter = [
  {
    scenario: "Opening a bank account",
    today: "Email scans of your passport and a utility bill, wait days for someone to check them by eye.",
    ssi: "Present a verified identity credential. The bank confirms it cryptographically in seconds.",
  },
  {
    scenario: "Proving your age at a venue",
    today: "Hand over your driving licence — the door staff see your full name, address, and date of birth.",
    ssi: "Tap your phone. It proves you're over 18 and nothing else.",
  },
  {
    scenario: "Starting a new job",
    today: "Request a reference, wait for a transcript, re-do the background check every time.",
    ssi: "Show a credential from your previous employer and university. Verified instantly, no phone calls.",
  },
  {
    scenario: "Logging into an app",
    today: "Create an account, choose a password, receive a code by email, hope nobody reused it.",
    ssi: "Sign in with your wallet. No password to steal, no email loop, no account to delete.",
  },
];

const dayInLife = [
  {
    step: "1",
    title: "Rent a flat",
    body: "Your estate agent requests proof of income and right-to-rent. You present two credentials from your wallet. They verify instantly — no scans, no waiting.",
  },
  {
    step: "2",
    title: "Start a job",
    body: "Your new employer asks for your degree and a background check. Your university already issued you a credential; you present it. No transcript request, no phone calls.",
  },
  {
    step: "3",
    title: "Open a bank account",
    body: "The bank needs KYC. Instead of uploading documents, you present a verified identity credential and a proof-of-address credential. Onboarding finishes in minutes.",
  },
  {
    step: "4",
    title: "Pick up a parcel",
    body: "The courier needs to confirm it's you. You present a minimal proof — just that this phone's owner is verified — without revealing your name or address.",
  },
];

const web2Opportunities = [
  {
    title: "Passwordless login",
    body: "Let users sign in with their wallet instead of a password. No credentials to steal, no reset flows to support, no email verification loops.",
  },
  {
    title: "Privacy-preserving checks",
    body: "Age, residency, accreditation — prove the fact without revealing the document. Useful for gaming, alcohol, finance, and healthcare.",
  },
  {
    title: "Lower breach liability",
    body: "When you're not storing copies of your users' passports and licences, there's nothing to leak. A breach stops being an identity crisis.",
  },
  {
    title: "Reusable KYC",
    body: "Verify a customer once, issue them a credential. They present it to every other service that needs the same check. Compliance gets cheaper for everyone.",
  },
];

const web3Opportunities = [
  {
    title: "Identity for blockchains",
    body: "Blockchains move value but don't say who you are. DIDs give addresses a verifiable identity layer without exposing real-world details.",
  },
  {
    title: "Token-gating without doxxing",
    body: "Prove you hold a token or meet a condition without linking your wallet to your name. Access stays private.",
  },
  {
    title: "DAO membership & reputation",
    body: "Issue membership and contribution credentials to DAO members. Reputation becomes portable and verifiable rather than trust-me screenshots.",
  },
  {
    title: "One wallet, everything",
    body: "The same wallet that holds your keys and tokens can hold your credentials. Identity, money, and proofs in one place you control.",
  },
];

const ssiVsSsiWeb3 = [
  {
    feature: "Needs a blockchain?",
    ssi: "No — SSI works with any trust anchor, including none for local use.",
    web3: "Optional — a ledger makes a strong, shared trust anchor for DIDs.",
  },
  {
    feature: "Who holds the keys?",
    ssi: "You, in a wallet you chose.",
    web3: "You, in the same wallet that may hold crypto.",
  },
  {
    feature: "Best for",
    ssi: "Replacing logins, KYC, and document checks in everyday services.",
    web3: "Adding a verifiable identity layer to on-chain activity.",
  },
  {
    feature: "Privacy default",
    ssi: "Selective disclosure — share the minimum.",
    web3: "Public-by-default unless you add selective disclosure.",
  },
];

function Learn() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <MarketingHeader />

      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-border/60"
        style={{ backgroundImage: "var(--gradient-hero)" }}
      >
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-24">
          <Badge
            variant="outline"
            className="mb-5 border-primary/40 text-primary sm:mb-6"
          >
            Self-sovereign identity, explained
          </Badge>
          <h1 className="font-display max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Identity you own and control.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:mt-6 sm:text-lg">
            Today, your identity lives in dozens of company databases. Self-sovereign
            identity (SSI) flips that: you hold proof of who you are in a wallet you
            control, and anyone can check it without phoning home. Here's what that
            means — in plain English, no technical background needed.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/app">Try it live</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
            >
              <a href="#problem">Why it matters</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Section nav */}
      <nav className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
          {sectionNav.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="whitespace-nowrap rounded-md px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      <article className="mx-auto max-w-5xl space-y-16 px-4 py-14 sm:space-y-24 sm:px-6 sm:py-20">
        {/* How it works at a glance */}
        <section>
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 text-primary"
          >
            At a glance
          </Badge>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            How SSI works, in one picture
          </h2>
          <div className="mt-8">
            <TrustTriangle />
          </div>
        </section>


        {/* Problem */}
        <section id="problem" className="scroll-mt-16">
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 text-primary"
          >
            The problem today
          </Badge>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Identity is borrowed, not owned
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Think about how identity works online today. Every time you want to do
            something — rent a flat, open a bank account, prove your age — you
            photocopy your documents and hand them to a stranger. They keep a copy.
            You keep doing it. It's slow, it's insecure, and you have no control.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {problems.map((p) => (
              <Card key={p.title} className="border-border/60 bg-card/60">
                <CardHeader>
                  <CardTitle className="font-display text-lg">
                    {p.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {p.body}
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-8">
            <FlowCompare />
          </div>
        </section>

        {/* What SSI changes */}
        <section id="pillars" className="scroll-mt-16">
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 text-primary"
          >
            What SSI changes
          </Badge>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Three ideas that fix it
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            SSI rests on three simple ideas. Together, they replace the
            "photocopy-and-hope" model with something you actually control.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {pillars.map((p, i) => {
              const Icon = pillarIcons[i % pillarIcons.length]!;
              return (
                <Card
                  key={p.title}
                  className="relative overflow-hidden border-border/60 bg-card/60"
                >
                  <span
                    className="font-display pointer-events-none absolute right-4 top-2 text-5xl font-semibold text-primary/10"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <CardHeader>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <Badge
                      variant="secondary"
                      className="mt-3 w-fit font-mono text-xs"
                    >
                      {p.tag}
                    </Badge>
                    <CardTitle className="font-display pt-2 text-lg">
                      {p.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {p.body}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Selective disclosure visual */}
          <div className="mt-10">
            <DisclosureChips />
          </div>

          {/* Before / After table */}
          <div className="mt-10 overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-card/60 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-mono font-medium">Scenario</th>
                  <th className="px-4 py-3 font-mono font-medium">Today</th>
                  <th className="px-4 py-3 font-mono font-medium text-primary">
                    With SSI
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {beforeAfter.map((row) => (
                  <tr key={row.scenario}>
                    <td className="px-4 py-3 font-medium">{row.scenario}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.today}
                    </td>
                    <td className="px-4 py-3 text-foreground">{row.ssi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Interactive demo */}
        <section id="demo" className="scroll-mt-16">
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 text-primary"
          >
            Try it
          </Badge>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            See it happen end-to-end
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Walk through a credential being issued to a wallet and then verified
            by someone else — five clicks, no setup.
          </p>
          <div className="mt-8">
            <CredentialDemo />
          </div>
        </section>

        {/* A day with SSI */}
        <section id="day" className="scroll-mt-16">
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 text-primary"
          >
            A day with SSI
          </Badge>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            What it feels like
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Instead of describing it, here's a morning where SSI is just… how
            things work. No scans, no waiting, no handing over more than you need
            to.
          </p>
          <div className="mt-8">
            <SsiTimeline items={dayInLife} />
          </div>
        </section>




        {/* Web2 opportunity */}
        <section id="web2" className="scroll-mt-16">
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 text-primary"
          >
            The web2 opportunity
          </Badge>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Upgrade what you already run
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            SSI isn't about throwing away the web you have. It's about replacing
            the fragile parts — passwords, document uploads, cold-start KYC —
            with something safer and faster.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {web2Opportunities.map((o) => (
              <div
                key={o.title}
                className="border-l-2 border-primary/50 pl-4"
              >
                <h3 className="font-mono text-sm font-medium text-primary">
                  {o.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{o.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Web3 opportunity */}
        <section id="web3" className="scroll-mt-16">
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 text-primary"
          >
            The web3 opportunity
          </Badge>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Where SSI and web3 meet
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Blockchains are great at moving value, but they don't tell you who is
            on the other end. SSI fills that gap — and the two complement each
            other more than they compete.
          </p>
          <div className="mt-8">
            <Web2Web3Split />
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">

            {web3Opportunities.map((o) => (
              <Card key={o.title} className="border-border/60 bg-card/60">
                <CardHeader>
                  <CardTitle className="font-display text-lg">
                    {o.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {o.body}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-10 overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-card/60 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-mono font-medium">Question</th>
                  <th className="px-4 py-3 font-mono font-medium">
                    SSI alone
                  </th>
                  <th className="px-4 py-3 font-mono font-medium text-primary">
                    SSI + web3
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {ssiVsSsiWeb3.map((row) => (
                  <tr key={row.feature}>
                    <td className="px-4 py-3 font-medium">{row.feature}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.ssi}
                    </td>
                    <td className="px-4 py-3 text-foreground">{row.web3}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 max-w-2xl text-sm text-muted-foreground">
            The honest version: SSI doesn't need a blockchain to work. But when
            you already have one, it makes a strong, shared trust anchor for
            resolving DIDs. They're partners, not rivals.
          </p>
        </section>

        {/* Zero-knowledge opportunity */}
        <section id="zk" className="scroll-mt-16">
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 text-primary"
          >
            <EyeOff className="mr-1.5 h-3.5 w-3.5" />
            The zero-knowledge opportunity
          </Badge>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Prove it without showing it
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            We said SSI lets you prove a fact without handing over the whole
            document. Zero-knowledge proofs are the cryptography that makes that
            real — and they go further than you might expect.
          </p>
          <div className="mt-8">
            <ZkProof />
          </div>
        </section>

        {/* Agentic opportunity */}
        <section id="agents" className="scroll-mt-16">
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 text-primary"
          >
            <Bot className="mr-1.5 h-3.5 w-3.5" />
            The agentic opportunity
          </Badge>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            AI agents need identity too
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Agents are starting to act on our behalf — booking, buying,
            negotiating with other agents. That makes two questions urgent:{" "}
            <em>who is this agent, and who does it act for?</em> and{" "}
            <em>is it allowed to do this?</em> Passwords and API keys can't
            answer either. DIDs and verifiable credentials can.
          </p>

          <div className="mt-8">
            <AgenticStack />
          </div>

          <h3 className="mt-10 font-display text-lg font-semibold">
            How delegation works, step by step
          </h3>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Instead of handing an agent your credentials, you hand it a narrow,
            time-boxed permission that anyone downstream can verify. Walk the
            chain one hop at a time.
          </p>
          <div className="mt-4">
            <DelegationWalkthrough />
          </div>

          <h3
            id="agents-demo"
            className="mt-10 scroll-mt-24 font-display text-lg font-semibold"
          >
            Try it: issue a mandate and verify the action
          </h3>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Grant an agent a scope, a spend cap and an expiry, then watch a
            verifier accept the honest action — or reject the ones that break the
            rules.
          </p>
          <div className="mt-4">
            <DelegationDemo />
          </div>
          <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
            Want the code behind this? The{" "}
            <Link to="/app/sandbox" className="text-primary hover:underline">
              sandbox quickstart
            </Link>{" "}
            has copy-paste TypeScript for issuing a delegation credential and
            verifying it before an agent acts.
          </p>




          <h3 className="mt-10 font-display text-lg font-semibold">
            Use cases: where delegation fits
          </h3>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Four protocols, four concrete flows. Tap a card to see the steps and
            the exact point where a verifiable delegation is checked.
          </p>
          <div className="mt-4">
            <AgenticUseCases />
          </div>



          <h3 className="mt-10 font-display text-lg font-semibold">
            What this unlocks
          </h3>
          <div className="mt-4 grid gap-5 sm:grid-cols-3">
            {[
              [
                "Buy within a budget",
                "Your agent books a flight and the merchant can prove the mandate was signed by you, capped and unexpired.",
              ],
              [
                "Prove without sharing",
                "An agent shows you're a verified customer over 18 without revealing your account or date of birth.",
              ],
              [
                "Agent-to-agent trust",
                "Two agents negotiate and each checks the other's issuer before exchanging anything of value.",
              ],
            ].map(([title, body]) => (
              <div key={title} className="border-l-2 border-primary/50 pl-4">
                <h4 className="font-mono text-sm font-medium text-primary">
                  {title}
                </h4>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 max-w-2xl text-sm text-muted-foreground">
            None of this needs a new stack. Identus already gives you the
            pieces these protocols assume: DIDs for agents and humans,
            credential issuance and verification, and revocation when a
            delegation should stop working. All four protocols above run as
            live demos in the console — real A2A messages, real signatures, and
            a real testnet payment.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link to="/app/demos">Run the agentic demos</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to="/app/credentials">Issue a delegation credential</Link>
            </Button>
          </div>
        </section>

        {/* AI agents FAQ */}
        <section id="agents-faq" className="scroll-mt-24">
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 text-primary"
          >
            <Bot className="mr-1.5 h-3.5 w-3.5" />
            Questions about agents
          </Badge>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Delegation, disclosure & verification for agents
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Short, plain-English answers to the questions that come up most when
            an AI agent starts acting on behalf of a person — how it proves it's
            allowed, what it can reveal, and how the other side checks it.
          </p>

          <div className="mt-8 space-y-8">
            {agentFaqGroups.map((group) => (
              <div key={group.heading}>
                <h3 className="mb-2 font-mono text-sm font-medium uppercase tracking-wide text-primary">
                  {group.heading}
                </h3>
                <Accordion type="multiple" className="border-b-0">
                  {group.items.map((item) => (
                    <AccordionItem
                      key={item.q}
                      value={item.q}
                      className="border-b border-border/60"
                    >
                      <AccordionTrigger className="text-sm font-medium">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </section>

        {/* Where Identus fits */}
        <section className="rounded-lg border border-border/60 bg-card/30 p-6 sm:p-10">
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 text-primary"
          >
            Where Identus fits
          </Badge>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            The open-source building blocks
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Hyperledger Identus is the open-source stack that makes SSI real:
            DIDs you can create and publish, secure connections between wallets,
            and verifiable credentials you can issue and check. This app lets you
            try all of it live — against a simulated agent first, then a real one
            you deploy yourself.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {[
              ["DIDs", "Create and publish identifiers you control."],
              ["Connections", "Link wallets securely over DIDComm."],
              ["Credentials", "Issue, hold, and verify proofs of fact."],
            ].map(([title, body]) => (
              <div key={title} className="border-l-2 border-primary/50 pl-4">
                <h3 className="font-mono text-sm font-medium text-primary">
                  {title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/auth">Try the live demo</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Link to="/docs">Read the primer</Link>
            </Button>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24">
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 text-primary"
          >
            <HelpCircle className="mr-1.5 h-3.5 w-3.5" />
            Quick answers
          </Badge>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Frequently asked questions
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Short, plain-English answers to the questions that come up most
            when people first meet DIDs, credentials, and verification.
          </p>

          <div className="mt-8 grid gap-8 lg:grid-cols-3">
            {faqGroups.map((group) => (
              <div key={group.heading}>
                <h3 className="mb-2 font-mono text-sm font-medium uppercase tracking-wide text-primary">
                  {group.heading}
                </h3>
                <Accordion type="multiple" className="border-b-0">
                  {group.items.map((item) => (
                    <AccordionItem
                      key={item.q}
                      value={item.q}
                      className="border-b border-border/60"
                    >
                      <AccordionTrigger className="text-sm font-medium">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            Want the technical version?{" "}
            <Link to="/docs" className="text-primary hover:underline">
              Read the primer
            </Link>
            .
          </p>
        </section>
      </article>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 sm:px-6 sm:py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Community project — not affiliated with the Hyperledger Foundation or
            the Linux Foundation.
          </span>
          <a
            className="text-primary hover:underline"
            href="https://identus.io/documentation/develop/"
            target="_blank"
            rel="noreferrer"
          >
            identus.io documentation
          </a>
        </div>
      </footer>
    </main>
  );
}
