"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Asks a van salesman to put the app on the phone's home screen. An installed app keeps its saved stock and opens with no signal. */
export function InstallHint() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try { dismissed = localStorage.getItem("depot.install.dismissed") === "1"; } catch { /* ignore */ }
    if (installed || dismissed) return;

    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setHidden(false);
    const onPrompt = (e: Event) => { e.preventDefault(); setEvent(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem("depot.install.dismissed", "1"); } catch { /* ignore */ }
  };

  if (hidden || (!event && !ios)) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#ff3b3f]/30 bg-[#ffe9ea] px-4 py-3 text-sm text-[#a50006]">
      <p className="min-w-60 flex-1">
        <strong>Put Depot on your home screen.</strong>{" "}
        {ios ? "Tap the Share button, then “Add to Home Screen”. " : ""}
        Your stock and prices stay saved on the phone, so the app opens and sells even when you close it or have no signal.
      </p>
      {event && <Button size="sm" onClick={async () => { await event.prompt(); setEvent(null); }}>Install</Button>}
      <button type="button" className="text-xs font-semibold underline" onClick={dismiss}>Not now</button>
    </div>
  );
}
