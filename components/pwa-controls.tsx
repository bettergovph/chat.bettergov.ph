"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Download, Smartphone } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const subscribeOnline = (callback: () => void) => {
  window.addEventListener("online", callback); window.addEventListener("offline", callback);
  return () => { window.removeEventListener("online", callback); window.removeEventListener("offline", callback); };
};
export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}
const subscribeInstalled = (callback: () => void) => {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", callback); window.addEventListener("appinstalled", callback);
  return () => { media.removeEventListener("change", callback); window.removeEventListener("appinstalled", callback); };
};

export function PwaControls() {
  const installButton = useRef<HTMLButtonElement>(null);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [help, setHelp] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const installed = useSyncExternalStore(subscribeInstalled, () => window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone), () => false);
  useEffect(() => {
    const beforeInstall = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const didInstall = () => { setPrompt(null); setAccepted(true); setHelp(null); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", didInstall);
    if (window.isSecureContext && "serviceWorker" in navigator) {
      // Never reload a conversation when a new worker becomes available.
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
    return () => { window.removeEventListener("beforeinstallprompt", beforeInstall); window.removeEventListener("appinstalled", didInstall); };
  }, []);
  if (installed || accepted) return null;
  return <>
    <button ref={installButton} className="install-button" type="button" aria-label="Install Kuya J" disabled={installing} onClick={async () => {
      if (prompt) {
        setInstalling(true);
        try { await prompt.prompt(); const choice = await prompt.userChoice; if (choice.outcome === "accepted") setAccepted(true); }
        catch { setHelp("Open your browser’s menu and choose Install app or Add to Home Screen, if available."); }
        finally { setPrompt(null); setInstalling(false); }
      } else if (!window.isSecureContext) setHelp("Open Kuya J using its HTTPS address to add it to your home screen. You can continue chatting at this address.");
      else if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) setHelp("Tap Share in your browser, then Add to Home Screen. Turn on Open as Web App if shown, and tap Add.");
      else setHelp("Open your browser’s menu and choose Install app or Add to Home Screen. On Safari for Mac, choose File → Add to Dock. If installation isn’t offered, you can keep using Kuya J in your browser.");
    }}><Download size={17} /><span>Install app</span></button>
    <Sheet open={help !== null} onOpenChange={open => { if (!open) setHelp(null); }}>
      <SheetContent className="info-sheet" onCloseAutoFocus={event => { event.preventDefault(); installButton.current?.focus(); }}><SheetHeader><div className="sheet-icon"><Smartphone size={24} /></div><SheetTitle>Keep Kuya J close</SheetTitle><SheetDescription>Add Kuya J to your home screen for an app experience.</SheetDescription></SheetHeader><div className="about-content"><p>{help}</p><p>An internet connection is needed for answers and source lookups. Conversations stay in this tab and are cleared when the app reloads.</p></div></SheetContent>
    </Sheet>
  </>;
}
