// Decorative: a crate seen from above. Each cell is a bottle slot; a few are filled.
const FILLED: Record<number, "white" | "mint"> = { 2: "white", 9: "mint", 11: "white", 14: "white", 20: "white", 23: "mint", 27: "white", 31: "white", 34: "mint", 40: "white", 43: "white", 46: "white" };

export function CratePattern({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`grid grid-cols-6 gap-2 rounded-xl border-2 border-white/20 p-3 ${className}`}>
      {Array.from({ length: 48 }, (_, i) => (
        <div
          key={i}
          className={`aspect-square rounded-full ${
            FILLED[i] === "white" ? "bg-white" : FILLED[i] === "mint" ? "bg-[#ffb9bb]" : "bg-white/10"
          }`}
        />
      ))}
    </div>
  );
}
