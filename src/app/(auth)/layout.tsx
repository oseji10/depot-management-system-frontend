import { Logo } from "../../components/logo";

/**
 * Drop a landscape image at frontend/public/auth-hero.jpg (about 1920x1080 or larger, landscape).
 * Until it exists the panel shows the green gradient.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <aside
        className="relative hidden bg-gradient-to-b from-[#ff3b3f] to-[#a50006] bg-cover bg-center lg:block"
        style={{ backgroundImage: "url(/cocacola.png), linear-gradient(to bottom, #ff3b3f, #a50006)" }}
        aria-hidden="true"
      />
      <main className="flex items-center justify-center px-5 py-10 lg:px-8">
        <div className="w-full max-w-sm">
          <Logo className="mb-8 h-14" />
          {children}
        </div>
      </main>
    </div>
  );
}
