import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BetterGovAttribution } from "@/components/bettergov-attribution";
import { KuyaJLogo } from "@/components/kuya-j-logo";
import { PolicyLinks } from "@/components/policy-links";
import { pageMetadata } from "@/lib/site-metadata";
import { SOURCES } from "@/lib/sources";
import { sourceRootUrl } from "@/lib/citations";

export const metadata = pageMetadata("/about", "About Kuya J — Philippine AI Assistant | BetterGov.ph", "Meet Kuya J, BetterGov.ph’s Philippine AI assistant. Explore its knowledge sources for services, laws, budgets, public projects and statistics.");

export default function AboutPage() {
  return <main className="policy-page">
    <a href="#about-content" className="skip-link">Skip to about Kuya J</a>
    <header className="policy-header"><Link href="/" className="policy-back"><ArrowLeft size={17} />Ask Kuya J</Link><BetterGovAttribution /></header>
    <article className="policy-document" id="about-content">
      <div className="policy-brand"><KuyaJLogo decorative /><span>KUYA J · BETTERGOV.PH</span></div>
      <h1>Your Philippine AI companion</h1>
      <p className="policy-summary">Kuya J helps you explore Philippine government services, laws, budgets and public data in one conversation. Ask in English, Filipino or Taglish, and follow the sources behind an answer.</p>
      <section><h2>Public knowledge, made clearer</h2><p>Find guidance on applying for a passport, look up a Republic Act, explore bills in Congress, or ask about infrastructure projects and national spending. Kuya J brings together information from specialized Philippine knowledge bases maintained across BetterGov and Juris projects.</p><p>This is an independent community initiative by BetterGov.ph. Kuya J is not an official government service and does not submit applications or make decisions for government agencies.</p></section>
      <section><h2>How answers come together</h2><p>Kuya J identifies which sources may help with your question, retrieves relevant records through their APIs or tools, and combines useful information into a readable answer. When a question spans several sources, it can bring those results together. References let you explore the knowledge bases used.</p><p>Source coverage and availability vary. AI can make mistakes or misinterpret a record, even when it includes references. Check important details with the relevant agency or a qualified professional.</p></section>
      <section><h2>Explore our {SOURCES.length} knowledge sources</h2><ul>{SOURCES.map(source => {
        const url = sourceRootUrl(source.url);
        if (!url) return null;
        return <li key={source.id}><strong>{source.name}:</strong> {source.description} <a href={url} target="_blank" rel="noopener noreferrer">{new URL(url).hostname}</a></li>;
      })}</ul></section>
      <section><h2>Questions you can ask</h2><ul>
        <li>How can I apply for a Philippine passport?</li>
        <li>What does the Data Privacy Act say about my personal information?</li>
        <li>Which bills has a particular senator filed?</li>
        <li>What flood control projects are recorded in my province?</li>
        <li>Where can I find PSA employment statistics?</li>
      </ul><p>A specific year, place, person or document helps Kuya J find more relevant information.</p></section>
      <section><h2>Your conversation stays in this session</h2><p>There is no account to create, and we do not store chat history on our servers. Messages are processed by external AI and source services to answer your question. Conversations are held in the current browser tab and clear when it is reloaded or closed. Read the <Link href="/privacy">Privacy Policy</Link> for details about processing and providers.</p></section>
      <section><h2>Keep Kuya J close</h2><p>You can install Kuya J from a supported browser for easy access from your home screen. An internet connection is needed to ask questions. Use the in-app Debug control to inspect source lookups and screening decisions.</p><p><Link href="/">Start a conversation with Kuya J →</Link></p></section>
    </article>
    <footer className="policy-footer"><PolicyLinks /><p>Built by 1 person. Zero funding. An initiative by BetterGov.ph.</p></footer>
  </main>;
}
