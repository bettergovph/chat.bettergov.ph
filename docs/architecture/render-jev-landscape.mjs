// Run: node docs/architecture/render-jev-landscape.mjs
// Diagram source: positioned SVG, original project logos and Inter Tight.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const directory = dirname(fileURLToPath(import.meta.url));
const stem = join(directory, "jev-chat-flow-landscape");
const width = 2400;
const height = 1490;
const embedded = (path, mime) => `data:${mime};base64,${readFileSync(join(directory, path)).toString("base64")}`;
const font = embedded("assets/InterTight-Variable.ttf", "font/ttf");
const logo = embedded("../../public/brand/bettergov-horizontal-primary.png", "image/png");
const mascot = embedded("../../public/brand/kuya-j-mascot.webp", "image/webp");
const escape = text => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const text = (x, y, label, css = "", anchor = "start") => `<text x="${x}" y="${y}" class="${css}" text-anchor="${anchor}">${escape(label)}</text>`;
const node = ({ id, x, y, w, title, sub, type = "", note = "", h = 128 }) => `<g id="${id}" class="node ${type}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/>${text(x+w/2, y+(note ? 39 : 51), title, "node-title", "middle")}${text(x+w/2, y+(note ? 73 : 88), sub, "node-sub", "middle")}${note ? text(x+w/2, y+104, note, "node-note", "middle") : ""}</g>`;
const arrow = (d, { dotted = false, color = "blue", label, x, y } = {}) => `<path d="${d}" class="edge ${dotted ? "dotted" : ""} ${color}" marker-end="url(#${color}Arrow)"/>${label ? text(x, y, label, "edge-label", "middle") : ""}`;
const detail = (x, y, title, lines) => `${text(x,y,title,"detail-title")}${lines.map((line,i)=>text(x,y+31+i*29,line,"detail-text")).join("")}`;
const nodes = [
  {id:"question",x:110,y:487,w:230,title:"Browser / PWA",sub:"Ask + validate"},
  {id:"planner",x:1000,y:487,w:305,title:"AI · tool planning",sub:"Choose tool + arguments",note:"Selected tools + lookup intent",type:"ai"},
  {id:"executor",x:1370,y:487,w:250,title:"Code",sub:"Read-only lookup"},
  {id:"reply",x:110,y:850,w:250,h:100,title:"Friendly reply",sub:"No answer-model call",type:"fallback"},
  {id:"output",x:110,y:1030,w:250,title:"Stream answer",sub:"Sources + Debug",type:"ai"},
  {id:"synthesis",x:470,y:1030,w:260,title:"AI",sub:"Consolidate sources",type:"ai"},
  {id:"context",x:840,y:1030,w:240,title:"Accepted context",sub:"+ citations"},
  {id:"documents",x:1785,y:315,w:500,h:100,title:"Documents + datasets",sub:"Public information"},
  {id:"retrieval",x:1785,y:455,w:500,h:100,title:"Source-owned retrieval",sub:"RAG · indexes · tables · records"},
  {id:"interfaces",x:1785,y:595,w:500,h:100,title:"Published APIs + MCP",sub:"Records · passages · metadata"},
];
const domains = [
  "juris.ph", "bills.juris.ph", "budget.bettergov.ph", "statistics.bettergov.ph",
  "officials.bettergov.ph", "bettergov.ph", "api.dpwh.bettergov.ph", "flood-control.bettergov.ph",
  "asean.bettergov.ph",
];
const requiredLabels = ["Using JEV as a chatbot router", "Batched screening", "Conversation aware", "Lookup intent", "Metadata screening", "Spam · prompt injection · jailbreak", "17 judgments · 1 request", "Citation titles + URLs", "Useful IDs · schemas · dimension codes"];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="diagramTitle diagramDesc">
<title id="diagramTitle">Using JEV as a chatbot router</title>
<desc id="diagramDesc">Jev-focused landscape flowchart. One input request returns 17 judgments over the latest question and submitted conversation: spam, prompt injection, jailbreak, programming, recipes, primary source, ten source relevance judgments, and lookup intent. Code selects permitted tools; AI chooses tool arguments and code executes source lookups. Batched Jev result screening includes text, citation titles and URLs, and retains useful discovery metadata. Accepted context reaches AI for consolidation and streaming. Dotted paths represent blocked requests and bounded retries. This is a focused view of civic lookups, not every application branch.</desc>
<defs><style>
@font-face{font-family:"Inter Tight";src:url(${font}) format("truetype");font-weight:100 900;font-display:block}
text{font-family:"Inter Tight",sans-serif;fill:#102c50}.title{font-size:58px;font-weight:780;letter-spacing:-1.5px}.subtitle{font-size:28px;fill:#496482}.section{font-size:24px;font-weight:730;letter-spacing:1px}.source-title{font-size:29px;font-weight:720}.source-sub{font-size:23px;fill:#536d87}.node rect{fill:white;stroke:#8babc9;stroke-width:2}.node-title{font-size:29px;font-weight:700}.node-sub{font-size:24px;fill:#45617f}.node-note{font-size:21px;fill:#45617f}.ai rect{fill:#edf4ff;stroke:#548ae0;stroke-width:2.3}.ai .node-title{fill:#0956bd}.fallback rect{fill:#fff8e9;stroke:#c7a66a}.fallback .node-title{font-size:27px;fill:#755119}.fallback .node-sub{font-size:21px;fill:#805f30}.boundary{fill:#fbfdff;stroke:#98afc8;stroke-width:2;stroke-dasharray:5 9;stroke-linecap:round}.source-boundary{fill:#f0f6ff;stroke:#6490c2}.edge{fill:none;stroke-width:2.6;stroke-linejoin:round}.blue{stroke:#4c75a8}.green{stroke:#008264}.dotted{stroke-dasharray:6 7}.edge-label{font-size:22px;font-weight:590;fill:#456385;paint-order:stroke;stroke:#fbfdff;stroke-width:8;stroke-linejoin:round}.note{font-size:22px;fill:#59728c}.domain{font-size:20px;font-weight:600;fill:#22558d}.benefit{font-size:28px;font-weight:650;fill:#115f50}.legend{font-size:21px;fill:#4b6682}.foot{font-size:22px;fill:#57718c}.site{font-size:26px;font-weight:700;fill:#0757b9}.jev-panel>rect{fill:#e6f7f0;stroke:#008b6b;stroke-width:3}.jev-title{font-size:33px;font-weight:800;fill:#006b51}.badge{font-size:21px;font-weight:650;fill:#08745c}.detail-title{font-size:26px;font-weight:720;fill:#075d49}.detail-text{font-size:24px;fill:#2f6156}.panel-rule{stroke:#a7d7c6;stroke-width:1.5}.policy{font-size:22px;fill:#466781}.debug{font-size:23px;fill:#466781}
#context .node-title{font-size:27px}
</style>
<marker id="blueArrow" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#4c75a8"/></marker>
<marker id="greenArrow" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#008264"/></marker></defs>
<rect width="${width}" height="${height}" fill="white"/><rect width="2400" height="12" fill="#075bd1"/>
${text(60,100,"Using JEV as a chatbot router","title")}
${text(62,149,"Kuya J · Screen requests. Route lookups. Filter context.","subtitle")}
<image href="${logo}" x="1780" y="51" width="325" height="82"/>
<image href="${mascot}" x="2148" y="46" width="86" height="95"/>
${text(2328,105,"Kuya J","source-title","end")}

<rect x="60" y="211" width="1620" height="1089" rx="20" class="boundary"/>
<rect x="1730" y="211" width="610" height="1089" rx="20" class="boundary source-boundary"/>
${text(100,264,"KUYA J · CHAT PIPELINE","section")}
${text(1640,264,"Jev supplies judgments. Code applies policy.","note","end")}
${text(1775,262,"Existing knowledge projects","source-title")}
${text(1775,293,"Independently built & maintained","source-sub")}

<g aria-label="Request and source flow">
${arrow("M340 551 H400")}
${arrow("M940 551 H990",{color:"green"})}
${arrow("M1305 551 H1360")}
${arrow("M1620 551 H1698 V627 H1775",{label:"Lookup",x:1725,y:612})}
${arrow("M2035 415 V445")}
${arrow("M2035 555 V585")}
${arrow("M1785 675 H1707 V1025 H1630",{label:"Results",x:1680,y:1007})}
</g>
<g aria-label="Accepted context and answer flow">
${arrow("M1160 1094 H1090",{color:"green",label:"Keep",x:1120,y:1081})}
${arrow("M840 1094 H740")}
${arrow("M470 1094 H370")}
${arrow("M110 1094 H83 V551 H100")}
</g>
<g aria-label="Input rejection and bounded research retries">
${arrow("M470 790 V900 H370",{dotted:true,label:"Blocked",x:516,y:848})}
${arrow("M235 950 V1020",{dotted:true})}
${arrow("M1450 850 V770 H1333 V586 H1315",{dotted:true,label:"Dropped result → retry",x:1473,y:754})}
<path d="M960 1030 V770 H1333" class="edge dotted blue"/>
${text(1102,754,"More needed","edge-label","middle")}
</g>

${nodes.map(node).join("\n")}
<g id="inputJev" class="node jev-panel">
  <rect x="410" y="320" width="530" height="470" rx="16"/>
  ${text(438,367,"JEV / INPUT","jev-title")}
  ${text(912,365,"17 judgments · 1 request","badge","end")}
  <line x1="438" y1="390" x2="912" y2="390" class="panel-rule"/>
  ${detail(438,429,"Conversation aware",["Latest question + conversation history"])}
  ${detail(438,508,"Batched screening",["Spam · prompt injection · jailbreak","Programming · recipes"])}
  ${detail(438,618,"Source routing",["Primary source + 10 relevance judgments"])}
  ${detail(438,699,"Lookup intent",["Search · exact record · statistics","Comparison · catalog · no lookup"])}
</g>
${text(225,654,"English · Filipino · Taglish","note","middle")}
${text(1152,658,"Code: up to 4 source families","policy","middle")}
${text(1152,690,"Uncertain → all 10","policy","middle")}

<g id="contextJev" class="node jev-panel">
  <rect x="1160" y="850" width="460" height="350" rx="16"/>
  ${text(1188,897,"JEV / CONTEXT","jev-title")}
  ${text(1592,925,"Batched results","badge","end")}
  <line x1="1188" y1="942" x2="1592" y2="942" class="panel-rule"/>
  ${detail(1188,978,"Relevance + injection",["Check source text and metadata"])}
  ${detail(1188,1062,"Metadata screening",["Citation titles + URLs"])}
  ${detail(1188,1146,"Preserve discovery data",["Useful IDs · schemas · dimension codes"])}
</g>
${text(760,941,"Bounded research loop","note","middle")}
${text(760,973,"Limits + duplicate-call checks","note","middle")}

${text(1775,767,"SOURCE DOMAINS","section")}
${domains.map((domain,i)=>text(1775+(i%2)*277,810+Math.floor(i/2)*43,domain,"domain")).join("\n")}
<line x1="1775" y1="1040" x2="2295" y2="1040" stroke="#bfd0e5"/>
${text(1775,1083,"APIs + MCP → live lookups","source-sub")}
${text(1775,1124,"Docs + llms.txt → integration guidance","source-sub")}
${text(1775,1220,"Retrieval stays with each source.","source-sub")}
${text(1775,1255,"No new central vector database.","source-sub")}

${text(100,1246,"Debug: judgments · routes · filter decisions · timing · Jev token usage","debug")}
${text(100,1279,"Civic lookup flow shown · source pages first, main site fallback","legend")}
<path d="M1230 1265 H1268" class="edge blue" marker-end="url(#blueArrow)"/>
${text(1280,1272,"Flow","legend")}
<path d="M1360 1265 H1398" class="edge dotted blue" marker-end="url(#blueArrow)"/>
${text(1410,1272,"Block / retry","legend")}

<line x1="60" y1="1340" x2="2340" y2="1340" stroke="#d6e2ef" stroke-width="2"/>
${text(62,1388,"Stop blocked requests early","benefit")}
${text(865,1388,"Send fewer tool schemas","benefit")}
${text(1650,1388,"Exclude rejected source text","benefit")}
${text(62,1430,"Efficiency = avoided AI work − Jev screening overhead","foot")}
${text(2340,1468,"chat.bettergov.ph","site","end")}
</svg>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=${width}"><title>Using JEV as a chatbot router</title><style>html,body{padding:0;margin:0;background:white;width:${width}px;height:${height}px}svg{display:block}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}@media print{@page{margin:0}}</style></head><body>${svg}</body></html>`;
const browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
try {
  const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:2});
  await page.setContent(html);
  const decodeImages = async () => {await document.fonts.ready;await Promise.all([...document.querySelectorAll("image")].map(e=>new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=reject;i.src=e.getAttribute("href");})));};
  await page.evaluate(decodeImages);
  const audit = await page.evaluate(({width,height,requiredLabels})=>{
    const texts=[...document.querySelectorAll("text")];
    const outOfBounds=texts.filter(e=>{const r=e.getBBox();return r.x<0||r.y<0||r.x+r.width>width||r.y+r.height>height;}).map(e=>e.textContent);
    const clippedNodes=[...document.querySelectorAll(".node")].filter(e=>{const box=e.querySelector("rect").getBBox();return [...e.querySelectorAll("text")].some(t=>{const b=t.getBBox();return b.x<box.x+8||b.x+b.width>box.x+box.width-8||b.y<box.y||b.y+b.height>box.y+box.height;});}).map(e=>e.id);
    const overlappingText=[];
    for(const node of document.querySelectorAll(".node")){
      const labels=[...node.querySelectorAll("text")];
      for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
        const a=labels[i].getBBox(),b=labels[j].getBBox();
        if(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)overlappingText.push(`${node.id}: ${labels[i].textContent} / ${labels[j].textContent}`);
      }
    }
    const clippedDomains=[...document.querySelectorAll(".domain")].filter(e=>{const b=e.getBBox();return b.x+b.width>2310;}).map(e=>e.textContent);
    const content=texts.map(e=>e.textContent).join("\n");
    return {fontLoaded:document.fonts.check('700 29px "Inter Tight"'),outOfBounds,clippedNodes,overlappingText,clippedDomains,missingLabels:requiredLabels.filter(label=>!content.includes(label)),unwantedClaims:/contradict|conflict|Built by|Zero funding/i.test(content),nodeCount:document.querySelectorAll(".node").length,sourceDomains:document.querySelectorAll(".domain").length};
  },{width,height,requiredLabels});
  if(!audit.fontLoaded||audit.outOfBounds.length||audit.clippedNodes.length||audit.overlappingText.length||audit.clippedDomains.length||audit.missingLabels.length||audit.unwantedClaims)throw new Error(JSON.stringify(audit));
  writeFileSync(`${stem}.svg`,svg);
  writeFileSync(`${stem}.html`,html);
  await page.screenshot({path:`${stem}.png`});
  await page.pdf({path:`${stem}.pdf`,width:`${width}px`,height:`${height}px`,printBackground:true,margin:{top:0,right:0,bottom:0,left:0}});
  const preview=await browser.newPage({viewport:{width:1440,height:Math.round(height*.6)},deviceScaleFactor:1});
  await preview.setContent(html.replace("</style>","body{zoom:.6}</style>"));
  await preview.evaluate(decodeImages);
  await preview.screenshot({path:`${stem}-preview.png`});
  writeFileSync(`${stem}-verification.json`,JSON.stringify({...audit,width,height,rasterScale:2},null,2)+"\n");
  console.log(JSON.stringify({...audit,width,height,rasterScale:2}));
}finally{await browser.close();}
