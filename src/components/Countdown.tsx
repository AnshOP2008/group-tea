import { useCountdown } from "@/hooks/use-countdown";

export function Countdown({ target, label = "Results unlock in" }: { target: Date | null; label?: string }) {
  const { ready, hh, mm, ss, done } = useCountdown(target);
  if (!target) {
    return (
      <div className="chip">⏳ Unlock time TBD</div>
    );
  }
  if (done) {
    return <div className="chip" style={{ background: "var(--color-pastel-mint)" }}>✨ Results are live</div>;
  }
  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 border border-border/60 shadow-[var(--shadow-card)]">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className="font-mono font-bold tabular-nums text-foreground">
        {ready ? `${hh}:${mm}:${ss}` : "--:--:--"}
      </span>
    </div>
  );
}
