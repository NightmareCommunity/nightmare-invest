"use client";
import { useApp, type Route } from "@/lib/store";
import { Logo } from "@/components/brand/logo";
import { GlassCard } from "@/components/brand/primitives";
import { ArrowLeft, Scale, Shield, Cookie, AlertTriangle } from "lucide-react";

const DOCS: Record<
  string,
  { title: string; icon: typeof Scale; updated: string; sections: { h: string; p: string }[] }
> = {
  tos: {
    title: "Terms of Service",
    icon: Scale,
    updated: "January 2025",
    sections: [
      { h: "1. Acceptance of Terms", p: "By accessing or using the Nightmare Invest platform (the “Platform”), you agree to be bound by these Terms of Service. If you do not agree, you must not access or use the Platform. The Platform is operated by Nightmare Invest Capital Ltd. (“Nightmare Invest”, “we”, “us”), a private investment manager." },
      { h: "2. Eligibility", p: "The Platform is available exclusively to accredited investors, professional investors, or qualified purchasers as defined under applicable securities laws in your jurisdiction. By registering, you represent and warrant that you meet such eligibility requirements and that you are at least 18 years of age." },
      { h: "3. The Fund", p: "The Nightmare Alpha Crypto Fund (the “Fund”) is a private investment vehicle. Participation in the Fund is subject to a separate Subscription Agreement and Private Placement Memorandum. These Terms govern access to the Platform only and do not constitute an offer to sell or a solicitation to buy any security." },
      { h: "4. No Investment Advice", p: "Information provided through the Platform is for informational and reporting purposes only. It does not constitute investment, legal, tax, or accounting advice. You should consult independent professional advisors before making any investment decision." },
      { h: "5. Account Security", p: "You are responsible for maintaining the confidentiality of your login credentials and for all activity occurring under your account. You must notify us immediately of any unauthorized access. We are not liable for any loss arising from compromised credentials." },
      { h: "6. Acceptable Use", p: "You agree not to attempt to access data or systems you are not authorized to access, not to misuse the Platform, not to introduce malicious code, and not to scrape or reverse-engineer Platform content. Violations may result in immediate account suspension." },
      { h: "7. Fees", p: "Fund fees are governed by the Subscription Agreement. The Platform itself does not charge access fees. We may modify fee disclosure with notice as required by agreement." },
      { h: "8. Limitation of Liability", p: "To the maximum extent permitted by law, Nightmare Invest shall not be liable for indirect, incidental, special, consequential, or punitive damages, or for any loss of profits or data, arising from your use of the Platform." },
      { h: "9. Termination", p: "We may suspend or terminate your access at any time, with or without cause, and without notice. Upon termination, all licenses granted to you cease immediately." },
      { h: "10. Governing Law", p: "These Terms are governed by the laws of Switzerland, without regard to conflict-of-laws principles. Disputes shall be resolved by arbitration in Zurich." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    icon: Shield,
    updated: "January 2025",
    sections: [
      { h: "1. Information We Collect", p: "We collect information you provide directly: name, email, KYC/AML documentation, and investment instructions. We also collect technical data including IP address, device identifiers, and usage logs for security and audit purposes." },
      { h: "2. How We Use Information", p: "We use your information to operate the Platform, process transactions, fulfill regulatory obligations, communicate with you, detect fraud, and maintain audit trails required for an institutional financial service." },
      { h: "3. Data Sharing", p: "We share data with qualified custodians, fund administrators, auditors, and regulators where legally required. We never sell your personal data. Sub-processors are bound by confidentiality and data-protection agreements." },
      { h: "4. Data Retention", p: "Financial records are retained for the period required by applicable law (typically 7–10 years). After this period, data is securely destroyed or anonymized." },
      { h: "5. Data Security", p: "We employ bank-grade encryption in transit (TLS 1.3) and at rest (AES-256), multi-signature custody, segregated infrastructure, SOC 2 Type II controls, and continuous security monitoring." },
      { h: "6. Your Rights", p: "Subject to applicable law, you may request access to, correction of, or deletion of your personal data. Contact privacy@nightmare.invest. Certain data may be retained to comply with legal obligations." },
      { h: "7. International Transfers", p: "Your data may be transferred to and processed in jurisdictions other than your own. We implement safeguards (e.g., Standard Contractual Clauses) for such transfers." },
      { h: "8. Cookies", p: "See our Cookie Policy for details on how we use cookies and similar technologies for authentication, security, and analytics." },
      { h: "9. Contact", p: "For privacy inquiries, contact our Data Protection Officer at privacy@nightmare.invest." },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    icon: Cookie,
    updated: "January 2025",
    sections: [
      { h: "1. What Are Cookies", p: "Cookies are small text files stored on your device. We use cookies and similar technologies (local storage, session tokens) to operate and secure the Platform." },
      { h: "2. Essential Cookies", p: "We use strictly necessary cookies to authenticate your session (JWT access and refresh tokens stored as httpOnly cookies). These cannot be disabled if you wish to use the Platform." },
      { h: "3. Security Cookies", p: "We use security tokens to detect fraud, prevent session hijacking, and maintain audit integrity. These are essential for institutional compliance." },
      { h: "4. Analytics", p: "We use privacy-respecting, first-party analytics to understand Platform usage. No third-party advertising cookies are deployed." },
      { h: "5. Managing Cookies", p: "You may clear cookies in your browser settings. Note that doing so will sign you out of the Platform. Essential cookies are required for functionality and security." },
      { h: "6. Updates", p: "We may update this policy as our use of cookies evolves. Material changes will be communicated via the Platform or by email." },
    ],
  },
  risk: {
    title: "Risk Disclosure",
    icon: AlertTriangle,
    updated: "January 2025",
    sections: [
      { h: "1. Nature of Digital Assets", p: "Digital assets are highly volatile and speculative. Prices can move sharply and unpredictably. You may lose some or all of your invested capital. Past performance is not indicative of future results." },
      { h: "2. No Guarantee of Returns", p: "Nightmare Invest does not guarantee any rate of return. The Fund’s NAV may decline. Returns are net of fees and are subject to market conditions, manager skill, and factors beyond anyone’s control." },
      { h: "3. Liquidity Risk", p: "The Fund offers scheduled liquidity windows. Redemption requests may be subject to gates, lock-ups, or side-pocketing as described in the Subscription Agreement. You may not be able to withdraw capital on demand." },
      { h: "4. Custody and Counterparty Risk", p: "Despite qualified custody and multi-signature controls, digital assets remain subject to risks including smart-contract failure, exchange insolvency, blockchain reorganizations, and theft. We mitigate but cannot eliminate these risks." },
      { h: "5. Regulatory Risk", p: "The regulatory environment for digital assets is evolving. Changes in law or regulation may adversely affect the Fund, your investment, or your ability to access the Platform." },
      { h: "6. Leverage and Derivatives", p: "The Fund may employ leverage, derivatives, or short positions. These strategies amplify both gains and losses and may result in rapid capital erosion under adverse conditions." },
      { h: "7. Tax Risk", p: "Tax treatment of digital assets is complex and uncertain. You are responsible for your own tax obligations. Consult a qualified tax advisor." },
      { h: "8. Suitability", p: "An investment in the Fund is suitable only for investors who can afford the loss of their entire commitment and who have sufficient knowledge and experience to evaluate the risks. If in doubt, do not invest." },
      { h: "9. Acknowledgment", p: "By accessing the Platform and committing capital, you acknowledge that you have read, understood, and accepted these risks." },
    ],
  },
};

export function LegalPage({ route }: { route: Extract<Route, { name: "legal" }> }) {
  const setRoute = useApp((s) => s.setRoute);
  const doc = DOCS[route.doc];
  const Icon = doc.icon;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border/60 glass-strong safe-area-top">
        <div className="mx-auto flex h-14 sm:h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <button onClick={() => setRoute({ name: "landing" })} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground tap-target-sm">
            <ArrowLeft className="h-4 w-4" /> Home
          </button>
          <Logo showText={false} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="h2-responsive font-bold tracking-tight break-words-mobile">{doc.title}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Last updated: {doc.updated}</p>
          </div>
        </div>

        <div className="mt-8 sm:mt-10 grid gap-6 sm:gap-8 lg:grid-cols-[220px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <GlassCard compact className="p-3 sm:p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Contents</div>
              <nav className="mt-3 space-y-1 max-h-48 lg:max-h-none overflow-y-auto scroll-luxury">
                {doc.sections.map((s, i) => (
                  <a
                    key={i}
                    href={`#sec-${i}`}
                    className="block rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-gold/10 hover:text-foreground break-words-mobile"
                  >
                    {s.h}
                  </a>
                ))}
              </nav>
            </GlassCard>
          </aside>

          <div className="space-y-6 sm:space-y-8 min-w-0">
            {doc.sections.map((s, i) => (
              <section key={i} id={`sec-${i}`} className="scroll-mt-20 sm:scroll-mt-24">
                <h2 className="h3-responsive font-semibold text-foreground break-words-mobile">{s.h}</h2>
                <p className="mt-2 body-responsive leading-relaxed text-muted-foreground break-words-mobile">{s.p}</p>
              </section>
            ))}
            <div className="border-t border-border/60 pt-6">
              <button onClick={() => setRoute({ name: "landing" })} className="text-sm text-gold hover:underline tap-target-sm">
                ← Return to Nightmare Invest
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/60 bg-black/40 mt-auto">
        <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-muted-foreground sm:px-6 safe-area-bottom">
          © {new Date().getFullYear()} Nightmare Invest · This document does not constitute legal or investment advice.
        </div>
      </footer>
    </div>
  );
}
