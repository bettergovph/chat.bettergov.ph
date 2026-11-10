"use client";

import { useState } from "react";
import { Bug, Check, ChevronDown, Copy, LoaderCircle } from "lucide-react";
import type { TraceEvent } from "@/lib/trace";

export function ResearchTrace({ events, running, stopped, onCopy }: { events: TraceEvent[]; running: boolean; stopped?: boolean; onCopy: (text: string) => Promise<void> }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  return <section className="research-trace" aria-label="Research debug trace">
    <div className="trace-header">
      <button className="trace-toggle" type="button" aria-expanded={open} onClick={() => setOpen(!open)}><Bug size={16} /><strong>Research trace</strong><span>{events.length} events</span><ChevronDown size={15} className={open ? "trace-chevron open" : "trace-chevron"} /></button>
      <button type="button" className="trace-copy" aria-label="Copy debug trace" disabled={!events.length} onClick={async () => { try { await onCopy(JSON.stringify(events, null, 2)); setCopied(true); setCopyFailed(false); setTimeout(() => setCopied(false), 2000); } catch { setCopyFailed(true); } }}>{copied ? <Check size={14} /> : <Copy size={14} />}<span>{copied ? "Copied" : copyFailed ? "Copy failed" : "Copy JSON"}</span></button>
    </div>
    {open && <>
      <p className="trace-explanation">Jev judgments and executed requests. A document link can differ from the API that supplied it. Scores are model estimates.</p>
      <ol className="trace-events">{events.map(event => <li key={event.sequence} className={`trace-event ${event.status}`}>
        <details>
          <summary><span className="trace-stage">{event.stage}</span><span className="trace-title">{event.title}<small>{event.status}{event.durationMs !== undefined ? ` · ${Math.round(event.durationMs)} ms` : ""}</small></span><time>+{(event.elapsedMs / 1000).toFixed(1)}s</time></summary>
          <pre>{JSON.stringify(event.detail, null, 2)}</pre>
        </details>
      </li>)}</ol>
      <div className="trace-footer">{running ? <><LoaderCircle size={13} className="spin" />Receiving live events…</> : stopped ? "Stopped. Events received before cancellation are retained." : "Trace stays with this answer for this tab session."}</div>
    </>}
  </section>;
}
