import { whatsappLink } from "../lib/share";

const ICON = "M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z";

/** Opens WhatsApp with the message filled in. The person taps send; nothing leaves the app by itself. */
export function WhatsAppButton({ phone, text, label = "Share on WhatsApp", size = "md", className = "" }: { phone?: string | null; text: string; label?: string; size?: "sm" | "md"; className?: string }) {
  return (
    <a
      href={whatsappLink(phone, text)} target="_blank" rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-[#25d366]/40 bg-[#25d366]/10 font-semibold text-[#128c4a] transition hover:bg-[#25d366]/20 ${size === "sm" ? "min-h-9 px-3 text-xs" : "min-h-11 px-4 text-sm"} ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true"><path d={ICON} /></svg>
      {label}
    </a>
  );
}
