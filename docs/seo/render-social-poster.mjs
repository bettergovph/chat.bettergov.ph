// Run from any directory; uses the project's existing Playwright dependency.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const directory = dirname(fileURLToPath(import.meta.url));
const root = join(directory, "../..");
const data = (path, mime) => `data:${mime};base64,${readFileSync(join(root, path)).toString("base64")}`;
const background = data("docs/seo/og-background.png", "image/png");
const mascot = data("public/brand/kuya-j-mascot.png", "image/png");
const logo = data("public/brand/bettergov-horizontal-white.png", "image/png");
const font = data("docs/architecture/assets/InterTight-Variable.ttf", "font/ttf");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Kuya J social poster</title><style>
@font-face{font-family:"Inter Tight";src:url("${font}") format("truetype");font-weight:100 900;font-style:normal;font-display:block}
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;font-family:"Inter Tight",sans-serif;background:#0032a0;color:white}main{width:1200px;height:630px;position:relative;overflow:hidden;background:linear-gradient(90deg,#03174750,transparent 72%),url("${background}") center/cover no-repeat}.logo{position:absolute;left:49px;top:31px;width:242px;height:auto}.eyebrow{position:absolute;left:58px;top:153px;font-size:16px;font-weight:650;letter-spacing:2.4px;color:#baddff}.headline{position:absolute;left:52px;top:175px;font-size:111px;line-height:1.05;font-weight:850;letter-spacing:-4.8px;margin:0}.description{position:absolute;left:58px;top:320px;font-size:30px;line-height:1.35;font-weight:500;letter-spacing:-.35px;margin:0;color:#f1f7ff}.languages{position:absolute;left:58px;top:427px;display:flex;gap:10px}.languages span{border:1px solid #7fb9ff70;background:#053c8f58;padding:8px 17px;border-radius:24px;font-size:17px;font-weight:550;line-height:1}.url{position:absolute;left:58px;top:522px;display:flex;gap:28px;align-items:center;background:white;border-radius:15px;padding:14px 19px 16px;color:#073aad;font-size:24px;font-weight:750;letter-spacing:-.3px}.url span{font-size:29px;line-height:1;font-weight:500}.mascot{position:absolute;right:42px;top:130px;width:411px;height:411px;object-fit:contain}.greeting{position:absolute;right:102px;top:77px;background:#eaf6ff;color:#09369c;padding:11px 22px 13px;border:1px solid white;border-radius:23px 23px 4px 23px;font-size:23px;font-weight:750;letter-spacing:-.2px}.source-note{position:absolute;right:64px;top:551px;display:flex;align-items:center;gap:9px;font-size:19px;font-weight:600;color:#fff}.source-note svg{width:21px;height:21px}.smallprint{position:absolute;left:58px;bottom:17px;font-size:12px;letter-spacing:.1px;color:#c3ddff}
</style></head><body><main aria-label="Kuya J, your Philippine AI companion"><img class="logo" src="${logo}" alt="BetterGov.ph"><div class="eyebrow">YOUR PHILIPPINE AI COMPANION</div><h1 class="headline">Ask Kuya J.</h1><p class="description">Government services. Laws. Budgets.<br>Public data, made clearer.</p><div class="languages"><span>English</span><span>Filipino</span><span>Taglish</span></div><div class="url">chat.bettergov.ph<span>↗</span></div><div class="greeting">Kumusta, Pilipinas!</div><img class="mascot" src="${mascot}" alt="Kuya J smiling and giving a thumbs-up"><div class="source-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/></svg>Answers with sources you can explore.</div><div class="smallprint">An independent civic initiative by BetterGov.ph.</div></main></body></html>`;
writeFileSync(join(directory, "kuya-j-og.html"), html);
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images, image => image.decode())); });
  const audit = await page.evaluate(() => ({
    fontLoaded: document.fonts.check('850 111px "Inter Tight"'),
    imagesLoaded: Array.from(document.images).every(image => image.naturalWidth > 0),
    outOfBounds: Array.from(document.querySelectorAll("main > *")).filter(element => { const box = element.getBoundingClientRect(); return box.left < 0 || box.top < 0 || box.right > 1200 || box.bottom > 630; }).map(element => element.className),
  }));
  if (!audit.fontLoaded || !audit.imagesLoaded || audit.outOfBounds.length) throw new Error(JSON.stringify(audit));
  mkdirSync(join(root, "public/social"), { recursive: true });
  const file = join(root, "public/social/kuya-j-og-v1.png");
  await page.screenshot({ path: file });
  console.log(JSON.stringify({ file, width: 1200, height: 630, ...audit }));
} finally { await browser.close(); }
