"use client";

import { useEffect, useRef, useState } from "react";
import { downloadBlob } from "../lib/pdf";
import { api } from "../lib/api";
import { whatsappLink, whatsappNumber } from "../lib/share";
import { Button, Modal } from "./ui";

const ICON = "M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z";

const isPhone = () => typeof navigator !== "undefined" && (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)));

const toBase64 = (f: File) => new Promise<string>((ok, bad) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).replace(/^data:[^,]*,/, ""));
  r.onerror = () => bad(new Error("The PDF could not be read."));
  r.readAsDataURL(f);
});

/** Whether this browser can hand a PDF file to other apps (phones, and Chrome/Edge/Safari on many computers). */
function canShareFiles(): boolean {
  try {
    return typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof navigator.canShare === "function"
      && navigator.canShare({ files: [new File(["%PDF"], "x.pdf", { type: "application/pdf" })] });
  } catch { return false; }
}

/**
 * Shares a PDF (receipt, invoice, payslip) to WhatsApp.
 *
 * With `link` and a phone number on file (the usual case): the PDF is stored on the server, then WhatsApp opens straight on
 * the person's chat with the message and a link to the PDF already typed. Press send; they tap the link to open the PDF.
 * (A web page cannot put a file into a particular chat; WhatsApp only allows a number and text. The link is how the file gets there.)
 * "Send the file itself" stays available underneath: it opens the share sheet with the PDF attached, then you pick the chat.
 *
 * Without a phone number:
 * - Where the browser can share files, the share sheet opens with ONLY the PDF (no text: when text is sent with a file,
 *   WhatsApp often keeps the text and drops the file). Pick WhatsApp, then the person.
 * - Otherwise the PDF is saved, WhatsApp opens on the person's number, and a window explains how to attach it.
 *
 * The PDF is built as soon as the button appears, so the click shares at once (browsers refuse to share once a click is "old").
 */
export function WhatsAppPdfButton({ make, cacheKey, phone, who, text, label, size = "md", className = "", link: linkAs }: {
  make: () => Promise<File>; cacheKey: string; phone?: string | null; who: string; text: string; label: string; size?: "sm" | "md"; className?: string;
  /** Send as a link in the person's chat: what the document is (decides who may share it) and the words before the link. */
  link?: { kind: "payslip" | "receipt" | "invoice"; refId?: number; caption: string };
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<File | null>(null);
  const promise = useRef<Promise<File> | null>(null);
  const file = useRef<File | null>(null);
  const makeRef = useRef(make);
  makeRef.current = make;

  const prepare = () => {
    if (!promise.current) {
      promise.current = makeRef.current().then((f) => { file.current = f; return f; });
      promise.current.catch(() => { promise.current = null; });
    }
    return promise.current;
  };

  useEffect(() => {
    promise.current = null; file.current = null;
    prepare().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const link = whatsappLink(phone, text);
  const [chatLink, setChatLink] = useState<string | null>(null);
  const direct = !!linkAs && !!whatsappNumber(phone);

  /** Store the PDF, then open the person's chat with the message and the PDF link typed in. */
  const sendInChat = async () => {
    setErr(null); setChatLink(null);
    const tab = isPhone() ? null : window.open("about:blank", "_blank"); // computer: open the tab while the click still counts
    setBusy(true);
    try {
      const f = await prepare();
      const { url } = await api<{ url: string }>("/shared-documents", {
        method: "POST", body: { kind: linkAs!.kind, ref_id: linkAs!.refId ?? null, filename: f.name, pdf: await toBase64(f) },
      });
      const message = `${text}\n\n${linkAs!.caption}: ${url}`;
      const n = whatsappNumber(phone);
      if (isPhone()) {
        // The WhatsApp app itself, on this person's chat.
        window.location.href = `whatsapp://send?phone=${n}&text=${encodeURIComponent(message)}`;
        setChatLink(whatsappLink(phone, message)); // in case WhatsApp did not open
      } else if (tab) {
        tab.location.href = whatsappLink(phone, message);
      } else {
        setChatLink(whatsappLink(phone, message));
      }
    } catch (e) {
      tab?.close();
      setErr(`${(e as Error).message || "The PDF could not be sent."} You can use "Send the file itself" instead.`);
    } finally { setBusy(false); }
  };

  const send = async () => {
    setErr(null);
    if (canShareFiles()) {
      try {
        const f = file.current ?? (setBusy(true), await prepare());
        await navigator.share({ files: [f] });
        return;
      } catch (e) {
        const name = (e as Error).name;
        if (name === "AbortError") return; // they closed the share sheet
        if (name !== "NotAllowedError" && name !== "TypeError" && name !== "DataError") { setErr((e as Error).message || "The PDF could not be made."); return; }
        // The browser refused to share: fall through to save + open WhatsApp.
      } finally { setBusy(false); }
    }

    const tab = window.open(link, "_blank");
    if (tab) tab.opener = null;
    setBusy(true);
    try {
      const f = await prepare();
      downloadBlob(f.name, f);
      setSaved(f);
    } catch (e) { setErr((e as Error).message || "The PDF could not be made."); }
    finally { setBusy(false); }
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={direct ? sendInChat : send} disabled={busy}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border border-[#25d366]/40 bg-[#25d366]/10 font-semibold text-[#128c4a] transition hover:bg-[#25d366]/20 disabled:opacity-60 ${size === "sm" ? "min-h-9 px-3 text-xs" : "min-h-11 px-4 text-sm"} ${className}`}>
        <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true"><path d={ICON} /></svg>
        {busy ? "Making PDF…" : label}
      </button>
      {direct && (
        <button type="button" onClick={send} disabled={busy} className="self-start text-[11px] font-medium text-ink-soft underline underline-offset-2 hover:text-ink">
          Send the file itself
        </button>
      )}
      {chatLink && <a href={chatLink} className="max-w-xs text-xs font-semibold text-[#128c4a] underline underline-offset-2">WhatsApp did not open? Tap here</a>}
      {err && <span role="alert" className="max-w-xs text-xs font-medium text-[#c23a3a]">{err}</span>}

      {saved && (
        <Modal title="Send the PDF on WhatsApp" onClose={() => setSaved(null)}>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>The PDF <span className="font-semibold">{saved.name}</span> is saved in your Downloads.</li>
            <li>WhatsApp is opening {whatsappNumber(phone) ? <>on {who}&apos;s number ({phone})</> : <>(there is no phone number for {who}, so pick them in WhatsApp)</>}. If it did not open, use the button below.</li>
            <li>Drag the PDF into the chat (or click the paperclip, then Document, and pick the file), then press send.</li>
          </ol>
          <p className="mt-3 rounded-xl bg-surface p-3 text-xs text-ink-soft">This browser cannot pass files to WhatsApp directly. On a phone (or Chrome or Edge with the WhatsApp app installed) the PDF goes straight into the chat.</p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => downloadBlob(saved.name, saved)}>Save PDF again</Button>
            <a href={link} target="_blank" rel="noopener noreferrer"><Button variant="secondary">Open WhatsApp chat</Button></a>
            <Button onClick={() => setSaved(null)}>Done</Button>
          </div>
        </Modal>
      )}
    </span>
  );
}
