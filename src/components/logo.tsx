/** The Depot Pro wordmark (public/depot-pro.svg, 300x80). Shown as-is; place it on a light background. */
export function Logo({ className = "h-12" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/depot-pro.svg" alt="Depot Pro" className={`w-auto select-none ${className}`} draggable={false} />
  );
}
