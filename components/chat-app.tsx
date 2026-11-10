"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, ArrowUpRight, BarChart3, BookOpen, Bug, Check, ChevronDown, CircleHelp, Copy, Database, Globe2, Landmark, LoaderCircle, MessageCircle, Plus, Scale, ShieldCheck, Sparkles, Square, Waves, WifiOff } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { SOURCES, type Citation } from "@/lib/sources";
import { KuyaJLogo } from "@/components/kuya-j-logo";
import { ResearchTrace } from "@/components/research-trace";
import { PwaControls, useOnline } from "@/components/pwa-controls";
import type { TraceEvent } from "@/lib/trace";
import { readSseData } from "@/lib/sse";
import { publicCitationUrl, resolveCitationUrl, sourceRootUrl, sourceSiteUrl } from "@/lib/citations";
import { BetterGovAttribution } from "@/components/bettergov-attribution";
import { PolicyLinks } from "@/components/policy-links";
import { useChatViewport } from "@/hooks/use-chat-viewport";

type Message = { id: string; role: "user" | "assistant"; content: string; sources?: Citation[]; warnings?: string[]; trace?: TraceEvent[]; stopped?: boolean; failed?: boolean; error?: string };
type Conversation = { id: string; title: string; messages: Message[] };
// getRandomValues also works on a private VM's plain-HTTP preview.
const makeId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
async function copyAnswer(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const field = document.createElement("textarea");
  field.value = text; field.style.position = "fixed"; field.style.left = "-9999px";
  document.body.append(field); field.select();
  try { if (!document.execCommand("copy")) throw new Error("Copy unavailable"); }
  finally { field.remove(); }
}
const suggestions = [
  { icon: Globe2, label: "Government services", description: "Find your way through public services and agencies.", prompt: "How can I apply for a Philippine passport?" },
  { icon: Scale, label: "Laws & your rights", description: "Make sense of laws and what they mean for you.", prompt: "What does the Data Privacy Act say about my personal information?" },
  { icon: Landmark, label: "National budget", description: "Understand where public funds are allocated.", prompt: "How much is the 2026 national budget, and where does it go?" },
  { icon: BookOpen, label: "Bills in Congress", description: "Explore proposed laws and the people behind them.", prompt: "What bills have been filed about education in the 20th Congress?" },
  { icon: Waves, label: "Public projects", description: "Look into infrastructure and flood control projects.", prompt: "Show me flood control projects in Bulacan and their budgets." },
  { icon: BarChart3, label: "Facts & statistics", description: "Explore the Philippines through public data.", prompt: "Find PSA statistics on Philippine employment." },
];
function Navigation({ conversations, active, busy, onNew, onSelect, onSources, onAbout }: { conversations: Conversation[]; active: string | null; busy: boolean; onNew: () => void; onSelect: (id: string) => void; onSources: () => void; onAbout: () => void }) {
  const { setOpenMobile } = useSidebar();
  const act = (callback: () => void) => { callback(); setOpenMobile(false); };
  return <Sidebar className="civic-sidebar">
    <SidebarHeader className="brand-header"><button type="button" className="brand" disabled={busy} onClick={() => act(onNew)} aria-label="Kuya J home"><KuyaJLogo /><span className="brand-wordmark">Kuya J</span></button></SidebarHeader>
    <div className="sidebar-actions">
      <Button className="new-chat" disabled={busy} onClick={() => act(onNew)}><Plus size={17} />New conversation</Button>
      <button className="nav-item" onClick={() => act(onSources)}><Database size={17} />Knowledge sources<span className="nav-count">{SOURCES.length}</span></button>
    </div>
    <div className="nav-section-label conversations-label">CONVERSATIONS</div>
    <SidebarContent className="nav-content" role="navigation" aria-label="Conversations">
      {conversations.length === 0 ? <p className="empty-history">Your conversations will appear here.</p> : conversations.map(c => <button key={c.id} disabled={busy} aria-current={active === c.id ? "page" : undefined} className={`history-item ${active === c.id ? "active" : ""}`} onClick={() => act(() => onSelect(c.id))}><MessageCircle size={15} /><span>{c.title}</span></button>)}
    </SidebarContent>
    <SidebarFooter className="nav-footer">
      <button className="nav-item about-button" onClick={() => act(onAbout)}><CircleHelp size={16} />About Kuya J<ArrowUpRight size={14} /></button>
      <div className="sidebar-attribution"><BetterGovAttribution /><PolicyLinks newTab /></div>
    </SidebarFooter>
  </Sidebar>;
}
export default function Home() {
  const viewport = useChatViewport();
  const online = useOnline();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [language, setLanguage] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [debug, setDebug] = useState(false);
  const [status, setStatus] = useState("");
  const [panel, setPanel] = useState<"sources" | "about" | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const sending = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const followAnswer = useRef(true);
  const panelReturnFocus = useRef<HTMLElement | null>(null);
  const messages = conversations.find(c => c.id === active)?.messages ?? [];
  const update = useCallback((conversationId: string, messageId: string, patch: Partial<Message>) => {
    setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, messages: c.messages.map(m => m.id === messageId ? { ...m, ...patch } : m) } : c));
  }, []);
  const send = useCallback(async (text: string) => {
    if (!text.trim() || sending.current || !navigator.onLine) return;
    sending.current = true;
    followAnswer.current = true;
    const conversationId = active ?? makeId();
    const history = conversations.find(c => c.id === active)?.messages ?? [];
    const user: Message = { id: makeId(), role: "user", content: text.trim() };
    const assistant: Message = { id: makeId(), role: "assistant", content: "", ...(debug ? { trace: [] } : {}) };
    setConversations(prev => active ? prev.map(c => c.id === active ? { ...c, messages: [...c.messages, user, assistant] } : c) : [{ id: conversationId, title: user.content, messages: [user, assistant] }, ...prev]);
    setActive(conversationId); setDraft(""); setBusy(true); setStatus("Finding the right sources…");
    const controller = new AbortController(); abort.current = controller;
    let answer = ""; let completed = false;
    const traceEvents: TraceEvent[] = [];
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ messages: [...history.filter(m => !m.failed && !m.stopped), user].slice(-16).map(({ role, content }) => ({ role, content: content.slice(0, 12000) })), language, debug }) });
      if (!response.ok) { const data = await response.json().catch(() => ({})) as { error?: string }; throw new Error(data.error || "The connection couldn’t be completed. Please try again."); }
      if (!response.body) throw new Error("The answer stream is unavailable. Please try again.");
      // Answer snapshots and optional debug events repeat some data, unlike the
      // provider's token deltas. Bound that transport separately.
      for await (const data of readSseData(response.body, controller.signal, 16_000_000)) {
        const event = JSON.parse(data);
        if (event.type === "trace" && debug && traceEvents.length < 200) { traceEvents.push(event as TraceEvent); update(conversationId, assistant.id, { trace: [...traceEvents] }); }
        if (event.type === "status") setStatus(event.message);
        if (event.type === "delta") { answer += event.text; update(conversationId, assistant.id, { content: answer }); }
        if (event.type === "answer") { answer = event.content; update(conversationId, assistant.id, { content: answer, sources: event.sources }); }
        if (event.type === "done") { completed = true; answer = event.content ?? answer; update(conversationId, assistant.id, { content: answer, sources: event.sources, warnings: event.warnings }); break; }
        if (event.type === "error") throw new Error(event.message);
      }
      if (!completed) throw new Error("The response was interrupted. Please try again.");
    } catch (e) {
      if (controller.signal.aborted) update(conversationId, assistant.id, { content: answer || "Response stopped.", stopped: true });
      else {
        const error = e instanceof Error ? e.message : "Something went wrong. Please try again.";
        update(conversationId, assistant.id, { content: answer || error, failed: true, ...(answer ? { error } : {}) });
      }
    } finally { sending.current = false; setBusy(false); setStatus(""); abort.current = null; }
  }, [active, conversations, language, debug, update]);
  const latestMessageContent = messages.at(-1)?.content;
  useEffect(() => {
    if (input.current) {
      input.current.style.height = "auto";
      input.current.style.height = Math.min(input.current.scrollHeight, 136) + "px";
    }
  }, [draft]);
  useEffect(() => { followAnswer.current = true; workspace.current?.scrollTo({ top: workspace.current.scrollHeight }); }, [active]);
  useEffect(() => { if (followAnswer.current) workspace.current?.scrollTo({ top: workspace.current.scrollHeight, behavior: busy || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }, [messages.length, busy, latestMessageContent]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    Promise.resolve(context.registerTool({ name: "ask_kuya_j", title: "Ask Kuya J", description: "Ask about Philippine public data and display a source-grounded answer. Sends this conversation to the configured AI provider.", inputSchema: { type: "object", properties: { question: { type: "string", minLength: 1, maxLength: 4000 } }, required: ["question"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: true }, execute: async (value: unknown) => { const question = (value as { question?: unknown })?.question; if (typeof question !== "string" || !question.trim() || question.length > 4000) throw new Error("Enter a question of 1–4000 characters."); if (sending.current) throw new Error("Wait for the current answer to finish."); await send(question); return { displayed: true }; } }, { signal: lifecycle.signal })).catch(() => {});
    return () => lifecycle.abort();
  }, [send]);
  const newChat = () => { if (busy) return; setActive(null); setDraft(""); setTimeout(() => input.current?.focus(), 0); };
  const choosePrompt = (prompt: string) => { setDraft(prompt); input.current?.focus(); };
  return <SidebarProvider ref={viewport} className="chat-viewport" style={{ "--sidebar-width": "252px" } as React.CSSProperties}>
    <a className="skip-link" href="#question">Skip to your question</a>
    <Navigation conversations={conversations} active={active} busy={busy} onNew={newChat} onSelect={id => { if (!busy) setActive(id); }} onSources={() => setPanel("sources")} onAbout={() => setPanel("about")} />
    <main className={`main-surface ${messages.length ? "chat-active" : ""}`}>
      <header className="topbar">
        <div className="topbar-title"><SidebarTrigger className="mobile-menu" /><Sparkles className="desktop-topbar-icon" size={19} /><span className="topbar-label">AI Assistant</span><span className="mobile-chat-brand"><KuyaJLogo decorative />Kuya J</span><span className="preview-label">BETA</span></div>
        <div className="topbar-actions">
          <button type="button" className={`debug-toggle ${debug ? "enabled" : ""}`} aria-label="Debug trace" aria-pressed={debug} disabled={busy} title="Include Jev decisions and API/MCP calls" onClick={() => setDebug(!debug)}><Bug size={16} /><span>Debug{debug ? " on" : ""}</span></button>
          <PwaControls />
          <button className="source-top-button" aria-label="Our sources" onClick={() => setPanel("sources")}><BookOpen size={18} /><span>Our sources</span></button>
        </div>
      </header>
      <section className="companion-header" aria-label="Your civic companion">
        <button className="hero-brand" type="button" onClick={newChat} disabled={busy} aria-label="Kuya J home"><KuyaJLogo decorative /><h1>Kuya J<span>Your Philippine civic companion</span></h1></button>
        <p className="community-notice">Independent community project · Not an official government service</p>
        <div className="knowledge-pills"><span className="philippines-pill"><span aria-hidden="true">🇵🇭</span> Philippines</span><button onClick={() => setPanel("sources")}><ShieldCheck size={14} />{SOURCES.length} knowledge sources<ChevronDown size={13} /></button></div>
      </section>
      {!online && <div className="connection-notice" role="status"><WifiOff size={17} /><span>You’re offline. Reconnect to send your question. Your draft is still here.</span></div>}
      <div ref={workspace} className="workspace-scroll" onScroll={event => { const area = event.currentTarget; followAnswer.current = area.scrollHeight - area.scrollTop - area.clientHeight < 72; }}>
        <div className={`chat-workspace ${messages.length ? "has-messages" : ""}`}>
          {messages.length === 0 ? <section className="welcome">
            <div className="sheet-handle" aria-hidden="true" />
            <div className="welcome-heading"><span className="welcome-eyebrow">A LITTLE CLARITY STARTS HERE</span><h2>Kumusta! What would you like to know?</h2><p>Ask in English, Filipino, or a little of both.</p></div>
            <div className="suggestion-grid">{suggestions.map(({ icon: Icon, label, description, prompt }) => <button key={label} className="suggestion" aria-label={`${label} ${prompt}`} onClick={() => choosePrompt(prompt)}><div className="suggestion-top"><span className="topic-icon"><Icon size={21} /></span><span className="suggestion-label">{label}</span><ArrowUpRight size={15} className="suggestion-arrow" /></div><p>{description}</p></button>)}</div>
            <div className="more-topics"><span>Also explore</span><button onClick={() => choosePrompt("Find election records for officials in my province.")}>Officials & elections</button><button onClick={() => choosePrompt("Show the PSA geographic classification codes for Philippine regions.")}>PSA classifications</button><button onClick={() => choosePrompt("Compare Philippine economic indicators with ASEAN countries.")}>ASEAN data<ArrowUpRight size={12} /></button></div>
            <footer className="workspace-footer"><span>Public knowledge, made clearer.</span><div><Link href="/about" target="_blank" rel="noopener noreferrer">About Kuya J</Link><span aria-hidden="true">·</span><a href="https://bettergov.ph" target="_blank" rel="noopener noreferrer">BetterGov.ph<ArrowUpRight size={12} /></a><span aria-hidden="true">·</span><a href="https://juris.ph" target="_blank" rel="noopener noreferrer">Juris.ph<ArrowUpRight size={12} /></a></div></footer>
          </section> : <section className="messages" aria-label="Conversation">{messages.map((message, index) => <article key={message.id} className={`message ${message.role}`}>
            <div className="message-heading">{message.role === "assistant" ? <><KuyaJLogo avatar decorative /><strong>Kuya J</strong><span>YOUR CIVIC COMPANION</span></> : <><span className="user-avatar">Y</span><strong>You</strong></>}</div>
            {message.content ? <div className={`answer-content ${message.failed && !message.error ? "error-message" : ""}`}><Markdown remarkPlugins={[remarkGfm]} components={{ img: () => null, a: ({ href, children }) => {
              const target = message.role === "assistant" ? resolveCitationUrl(href, message.sources ?? []) : href;
              const parts = Children.toArray(children);
              const rawUrlLabel = parts.every(part => typeof part === "string") && /^https?:\/\/\S+$/.test(parts.join(""));
              return target ? <a href={target} target="_blank" rel="noopener noreferrer">{message.role === "assistant" && rawUrlLabel ? sourceRootUrl(target) : children}</a> : <>{children}</>;
            } }}>{message.content}</Markdown></div> : <div className="research-status" role="status"><LoaderCircle size={17} className="spin" />{status || "Preparing your answer…"}</div>}
            {busy && index === messages.length - 1 && message.content && <div className="research-status" role="status"><LoaderCircle size={14} className="spin" />{status || "Writing your answer…"}</div>}
            {message.trace && <ResearchTrace events={message.trace} running={busy && index === messages.length - 1} stopped={message.stopped} onCopy={copyAnswer} />}
            {message.sources && message.sources.length > 0 && <div className="answer-sources"><div className="answer-sources-label"><BookOpen size={14} />Sources used</div><div className="citation-grid">{message.sources.map(source => <a key={source.id} href={publicCitationUrl(source)} target="_blank" rel="noopener noreferrer" className="citation-card"><span className="citation-number">{source.id}</span><div><strong>{source.title}</strong><span>{sourceRootUrl(publicCitationUrl(source) ?? source.url)}</span></div><ArrowUpRight size={14} /></a>)}</div></div>}
            {message.warnings?.map((warning, i) => <p key={i} className="source-warning">{warning}</p>)}
            {message.error && <p className="source-warning" role="alert">Response incomplete. {message.error}</p>}
            {message.stopped && message.content !== "Response stopped." && <p className="source-warning">Response stopped. This answer is incomplete.</p>}
            {message.failed && <Button variant="outline" size="sm" onClick={() => send(messages[index - 1]?.content ?? "")} disabled={busy || !online}>Try again</Button>}
            {message.role === "assistant" && message.content && !message.failed && !busy && <button className="copy-button" onClick={async () => { try { await copyAnswer(message.content); setCopied(message.id); setTimeout(() => setCopied(null), 1800); } catch { setCopied("error:" + message.id); setTimeout(() => setCopied(null), 2500); } }}>{copied === message.id ? <Check size={15} /> : <Copy size={15} />}{copied === message.id ? "Copied" : copied === "error:" + message.id ? "Couldn’t copy" : "Copy answer"}</button>}
          </article>)}</section>}
        </div>
      </div>
      <div className="composer-region"><div className="composer-inner">
        <div className="composer-settings"><button type="button" className="composer-sources" onClick={() => setPanel("sources")}><Database size={15} />Public knowledge<ChevronDown size={13} /></button><div className="language-choice"><Globe2 size={14} /><select aria-label="Answer language" value={language} onChange={e => setLanguage(e.target.value)}><option value="auto">English / Filipino</option><option value="en">English</option><option value="fil">Filipino</option></select></div></div>
        <form className={`composer ${busy ? "is-busy" : ""}`} onSubmit={e => { e.preventDefault(); void send(draft); }}><label htmlFor="question" className="sr-only">Your question for Kuya J</label><textarea id="question" ref={input} rows={1} maxLength={4000} placeholder="Ask Kuya J anything…" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(draft); } }} />{busy ? <button type="button" className="send-button stop-button" aria-label="Stop response" onClick={() => abort.current?.abort()}><Square size={16} fill="currentColor" /></button> : <button type="submit" className="send-button" aria-label="Send question" disabled={!draft.trim() || !online}><ArrowUp size={22} /></button>}</form>
        <p className="composer-disclaimer">Kuya J can make mistakes. Verify important information. <span>By using Kuya J, you agree to our <Link href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</Link>. See our <Link href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.</span></p>
      </div></div>
    </main>
    <Sheet open={panel !== null} onOpenChange={open => { if (!open) setPanel(null); }}>
      <SheetContent className="info-sheet" onOpenAutoFocus={() => { panelReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={event => { event.preventDefault(); const trigger = panelReturnFocus.current; if (trigger?.isConnected && trigger.getClientRects().length && trigger.matches("button,a,input,textarea,select,[tabindex]")) trigger.focus(); else input.current?.focus(); }}>
        <SheetHeader>
          {panel === "sources" ? <div className="sheet-icon"><Database size={23} /></div> : <KuyaJLogo className="about-logo" />}
          <SheetTitle>{panel === "sources" ? "Knowledge you can trace" : "Meet Kuya J"}</SheetTitle>
          <SheetDescription>{panel === "sources" ? "Kuya J selects relevant sources for each question. Availability and coverage vary by provider." : "Your companion for understanding Philippine government and public information."}</SheetDescription>
        </SheetHeader>
        {panel === "sources" ? <div className="source-directory">
          {SOURCES.map(source => <a href={sourceSiteUrl(source.id)} key={source.id} target="_blank" rel="noopener noreferrer"><div><strong>{source.name}</strong><p>{source.description}</p><span className="source-domain">{sourceSiteUrl(source.id)}</span></div><ArrowUpRight size={17} /></a>)}
          <p className="directory-note">Source links open each knowledge base’s homepage. These community projects organize public records. Check reporting dates, coverage, and official records before making decisions.</p>
        </div> : <div className="about-content">
          <p>Ask in English, Filipino, or a mix of both. Kuya J searches public records and explains what it finds, with sources so you can check for yourself.</p>
          <h3>Clarity, with context</h3>
          <p>Bills are different from laws. Budget proposals are different from actual spending. Historical election results don’t guarantee who holds office today.</p>
          <h3>Your privacy</h3>
          <p>We do not store your chat history on our servers. Conversations stay in this tab and disappear on reload. Answering and screening providers process messages, and data providers receive relevant search terms. Hosting and security services may retain operational metadata. Avoid sharing sensitive personal information.</p>
          <p>Read our <Link href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link> for details about processing, retention and your choices.</p>
          <h3>A community companion</h3>
          <p>Kuya J is an initiative by BetterGov.ph, independent of the Philippine government. Answers are a starting point for research, not official advice or a substitute for a qualified professional.</p>
          <p><Link href="/about" target="_blank" rel="noopener noreferrer">Learn how Kuya J works and explore its knowledge sources.</Link></p>
          <p>By using Kuya J, you agree to our <Link href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</Link>.</p>
          <div className="about-attribution"><BetterGovAttribution /></div>
        </div>}
      </SheetContent>
    </Sheet>
  </SidebarProvider>;
}
