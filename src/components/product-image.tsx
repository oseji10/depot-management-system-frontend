"use client";

import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "../lib/auth";

// Pictures are private, so the browser fetches them with the sign-in token and shows a local copy.
const cache = new Map<string, Promise<string | null>>();

function load(url: string): Promise<string | null> {
  let hit = cache.get(url);
  if (!hit) {
    hit = fetch(`${API_URL}${url}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => (b ? URL.createObjectURL(b) : null))
      .catch(() => null);
    cache.set(url, hit);
  }
  return hit;
}

/** A private product picture as something an <img> can show. Null until loaded, or if there is none. */
export function useProductImage(url?: string | null): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setSrc(null);
    if (url) void load(url).then((s) => { if (live) setSrc(s); });
    return () => { live = false; };
  }, [url]);

  return src;
}

/** Product picture from the API; falls back to the first letter when there is none or it fails to load. */
export function ProductThumb({ url, name, className = "size-11 rounded-xl", fallbackClass = "" }: { url?: string | null; name: string; className?: string; fallbackClass?: string }) {
  const src = useProductImage(url);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={`${className} shrink-0 bg-white object-cover ring-1 ring-line`} />
    );
  }

  return (
    <span className={`${className} grid shrink-0 place-items-center text-base font-bold ring-1 ${fallbackClass}`} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Shrinks a chosen photo to at most 800px and returns it as a JPEG data URL (phone photos are huge). */
export async function shrinkImage(file: File, max = 800): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPEG, PNG or WebP picture.");

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot process pictures.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/jpeg", 0.85);
}

/** Shrinks a logo to at most 500px wide/high. Keeps transparency (PNG) unless the result would be too big. */
export async function shrinkLogo(file: File, max = 500): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a PNG, JPEG or WebP picture.");

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot process pictures.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const png = canvas.toDataURL("image/png");
  if (png.length < 900_000) return png;

  // Too heavy as PNG (a photo, say): flatten onto white and send a JPEG.
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}
