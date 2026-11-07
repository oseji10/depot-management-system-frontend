import { Suspense, type ComponentType } from "react";

/** Static export needs a Suspense boundary around any page that reads the query string. */
export function withSuspense<P extends object>(Page: ComponentType<P>) {
  return function SuspendedPage(props: P) {
    return (
      <Suspense fallback={<div className="py-16 text-center text-sm text-ink-soft">Loading…</div>}>
        <Page {...props} />
      </Suspense>
    );
  };
}
