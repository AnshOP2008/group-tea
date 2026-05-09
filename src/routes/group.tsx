import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId, getFingerprint, getChosenGroup, setChosenGroup, isLikelyIncognito, MAX_TEA, VOTES_PER_GROUP } from "@/lib/device";
import { toast } from "sonner";

export const Route = createFileRoute("/group")({
  component: GroupSelect,
});

function GroupSelect() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<number | null>(null);
  const [incog, setIncog] = useState(false);
  const [teaCount, setTeaCount] = useState(0);

  useEffect(() => {
    setExisting(getChosenGroup());
    isLikelyIncognito().then(setIncog);
    (async () => {
      const id = getDeviceId();
      const [{ data }, { count }] = await Promise.all([
        supabase.from("devices").select("chosen_group").eq("device_id", id).maybeSingle(),
        supabase.from("tea").select("id", { count: "exact", head: true }).eq("device_id", id),
      ]);
      if (data?.chosen_group) {
        setExisting(data.chosen_group);
        setChosenGroup(data.chosen_group);
      }
      setTeaCount(count ?? 0);
    })();
  }, []);

  // Decide where to go after a group pick:
  // - If user hasn't completed all 3 votes for THIS group → /vote/q (next missing)
  // - Else → /tea (if under MAX_TEA)
  async function routeAfterPick(g: number) {
    const id = getDeviceId();
    const { data: vs } = await supabase
      .from("votes")
      .select("question")
      .eq("device_id", id)
      .eq("group_number", g);
    const done = new Set((vs || []).map((v) => v.question));
    for (let q = 1; q <= VOTES_PER_GROUP; q++) {
      if (!done.has(q)) {
        nav({ to: "/vote/$q", params: { q: String(q) } });
        return;
      }
    }
    nav({ to: "/tea" });
  }

  async function pick(g: number) {
    setBusy(true);
    const id = getDeviceId();
    const fp = getFingerprint();
    const { error } = await supabase.from("devices").upsert({
      device_id: id,
      chosen_group: g,
      fingerprint: fp,
    }, { onConflict: "device_id" });
    setBusy(false);
    if (error) {
      toast.error("Couldn't save. Try again.");
      return;
    }
    setChosenGroup(g);
    await routeAfterPick(g);
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-3xl mx-auto px-4 pt-8 pb-20">
        <div className="animate-fade-up">
          <h1 className="font-display text-3xl font-bold">Which group are you in?</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Pick your group to vote. You can switch groups any time. Everything is anonymous.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Per group: 3 votes (one per question). Per device: up to {MAX_TEA} teas total.
          </p>
        </div>

        {incog && (
          <div className="mt-4 glass-card p-4 text-sm" style={{ background: "oklch(0.95 0.06 95 / 0.7)" }}>
            ⚠️ Looks like you might be in private/incognito mode. Your participation might not stick if you close the tab.
          </div>
        )}

        {existing && (
          <div className="mt-4 glass-card p-4 text-sm flex flex-wrap gap-3 items-center">
            <span>Last picked: <b>Group {existing}</b>.</span>
            <Link to="/vote/$q" params={{ q: "1" }} className="underline font-semibold">Continue voting →</Link>
            {teaCount < MAX_TEA && (
              <Link to="/tea" className="underline font-semibold">Spill tea ({teaCount}/{MAX_TEA}) →</Link>
            )}
          </div>
        )}

        <div className="mt-6 grid grid-cols-3 sm:grid-cols-4 gap-3">
          {Array.from({ length: 24 }, (_, i) => i + 1).map((g) => {
            const isPicked = existing === g;
            return (
              <button
                key={g}
                disabled={busy}
                onClick={() => pick(g)}
                className={`relative aspect-square rounded-2xl font-display text-2xl font-bold transition-all
                  ${isPicked ? "bg-gradient-to-br from-[oklch(0.78_0.13_305)] to-[oklch(0.82_0.1_340)] text-white shadow-[var(--shadow-soft)]" :
                    "bg-white/80 hover:bg-white border border-border hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]"}`}
              >
                {g}
                {isPicked && <span className="absolute top-1 right-2 text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
