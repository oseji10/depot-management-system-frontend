"use client";

import { useEffect, useState } from "react";

/** True while the element with this id is on screen (used to hide the floating "Review" bar once the cart is showing). */
export function useInView(id: string): boolean {
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = document.getElementById(id);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => setSeen(e.isIntersecting && e.intersectionRatio > 0.35), { threshold: [0, 0.35, 0.6] });
    obs.observe(el);
    return () => obs.disconnect();
  });

  return seen;
}
