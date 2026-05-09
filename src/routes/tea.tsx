import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { getChosenGroup, getDeviceId, MAX_TEA, VOTES_PER_GROUP } from "@/lib/device";
import { toast } from "sonner";

export const Route = createFileRoute("/tea")({
  component: TeaSubmit,
});

function TeaSubmit() {
  const nav = useNavigate();
  const [group, setGroup] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [teaCount, setTeaCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [needsVotes, setNeedsVotes] = useState<number | null>(null); // next missing question for current group

  async function refresh(g: number) {
    const id = getDeviceId();
    const [{ count }, { data: vs }] = await Promise.all([
      supabase.from("tea").select("id", { count: "exact", head: true }).eq("device_id", id),
      supabase.from("votes").select("question").eq("device_id", id).eq("group_number", g),
    ]);
    setTeaCount(count ?? 0);
    const done = new Set((vs || []).map((v) => v.question));
    let missing: number | null = null;
    for (let q = 1; q <= VOTES_PER_GROUP; q++) if (!done.has(q)) { missing = q; break; }
    setNeedsVotes(missing);
    setLoading(false);
  }

  useEffect(() => {
    const g = getChosenGroup();
    if (!g) { nav({ to: "/group" }); return; }
    setGroup(g);
    refresh(g);
  }, [nav]);

  async function send() {
    if (!group || !msg.trim()) return;
    if (teaCount >= MAX_TEA) { toast.error(`Max ${MAX_TEA} teas per device`); return; }
    if (needsVotes !== null) { toast.error("Finish voting first"); return; }
    setBusy(true);
    const { error } = await supabase.from("tea").insert({
      device_id: getDeviceId(),
      group_number: group,
      message: msg.trim().slice(0, 300),
    });
    setBusy(false);
    if (error) {
      toast.error("Couldn't submit. Try again.");
      return;
    }
    setMsg("");
    toast.success("Tea steeped ☕ — pending review");
    refresh(group);
  }

  const remaining = Math.max(0, MAX_TEA - teaCount);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-20">
        <div className="glass-card p-6 animate-fade-up">
          <div className="text-xs font-semibold text-muted-foreground">Group {group} · Anonymous</div>
          <h1 className="font-display text-3xl font-bold mt-1">Spill some tea ☕</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Up to {MAX_TEA} teas per device. 150 chars each. Be playful, not toxic — moderators review before publishing.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            <Link to="/group" className="underline">Switch group →</Link>
          </p>

          {loading ? (
            <div className="mt-5 text-sm text-muted-foreground">Loading…</div>
          ) : needsVotes !== null ? (
            <div className="mt-5 p-4 rounded-2xl bg-[oklch(0.95_0.07_85)]/70 border border-[oklch(0.85_0.1_85)]">
              You need to finish voting for Group {group} first.{" "}
              <Link to="/vote/$q" params={{ q: String(needsVotes) }} className="underline font-semibold">Vote on Q{needsVotes} →</Link>
            </div>
          ) : remaining === 0 ? (
            <div className="mt-5 p-4 rounded-2xl bg-[oklch(0.93_0.07_160)]/60 border border-[oklch(0.85_0.1_160)]">
              ✅ You've used all {MAX_TEA} tea submissions. Thanks for the spill!
            </div>
          ) : (
            <>
              <div className="mt-3 text-xs text-muted-foreground">{teaCount}/{MAX_TEA} used · {remaining} left</div>
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value.slice(0, 150))}
                placeholder="The funniest, sweetest, weirdest thing about your group…"
                rows={4}
                className="mt-3 w-full px-4 py-3 rounded-2xl bg-white/90 border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-muted-foreground">{msg.length}/150</span>
                <button onClick={send} disabled={!msg.trim() || busy} className="pastel-btn disabled:opacity-50">
                  {busy ? "Brewing…" : "Submit tea"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link to="/wait" className="underline text-sm text-muted-foreground">See countdown →</Link>
        </div>
      </main>
    </div>
  );
}
