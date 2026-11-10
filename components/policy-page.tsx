import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BetterGovAttribution } from "@/components/bettergov-attribution";
import { KuyaJLogo } from "@/components/kuya-j-logo";
import { PolicyLinks } from "@/components/policy-links";

export function PolicyPage({ title, summary, children, effectiveDate = "21 September 2026" }: { title: string; summary: string; children: React.ReactNode; effectiveDate?: string }) {
  return <main className="policy-page">
    <a href="#policy-content" className="skip-link">Skip to policy</a>
    <header className="policy-header"><Link href="/" className="policy-back"><ArrowLeft size={17} />Back to Kuya J</Link><BetterGovAttribution /></header>
    <article className="policy-document" id="policy-content">
      <div className="policy-brand"><KuyaJLogo decorative /><span>KUYA J · BETTERGOV.PH</span></div>
      <h1>{title}</h1>
      <p className="policy-date">Effective {effectiveDate}</p>
      <p className="policy-summary">{summary}</p>
      {children}
    </article>
    <footer className="policy-footer"><PolicyLinks /><p>An independent community project. Not an official government service.</p></footer>
  </main>;
}
