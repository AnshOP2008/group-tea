import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { getChosenGroup, getDeviceId } from "@/lib/device";
import { QUESTIONS } from "@/lib/questions";
import { toast } from "sonner";

type Student = { id: string; name: string; roll_number: string; group_number: number };

export const Route = createFileRoute("/vote/$q")({
  component: VoteScreen,
});

function VoteScreen() {
  const { q } = Route.useParams();
  const nav = useNavigate();
  const qNum = Math.max(1, Math.min(3, Number(q) || 1));
  const question = QUESTIONS[qNum - 1];

  const [chosenGroup, setChosenGroup] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const g = getChosenGroup();
    if (!g) {
      nav({ to: "/group" });
      return;
    }
    setChosenGroup(g);

    (async () => {
      const [stuRes, voteRes] = await Promise.all([
        supabase.from("students").select("*").eq("group_number", g).order("name"),
        supabase.from("votes").select("voted_for").eq("device_id", getDeviceId()).eq("question", qNum).eq("group_number", g).maybeSingle(),
      ]);
      setStudents((stuRes.data || []) as Student[]);
      if (voteRes.data?.voted_for) setSelected(voteRes.data.voted_for);
      setLoading(false);
    })();
  }, [qNum, nav]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q) || s.roll_number.toLowerCase().includes(q));
  }, [students, search]);

  async function submit() {
    if (!selected || !chosenGroup) return;
    setSaving(true);
    const device_id = getDeviceId();
    const { error } = await supabase
      .from("votes")
      .upsert(
        { device_id, question: qNum, voted_for: selected, group_number: chosenGroup, updated_at: new Date().toISOString() },
        { onConflict: "device_id,group_number,question" }
      );
    setSaving(false);
    if (error) {
      toast.error("Couldn't save vote.");
      return;
    }
    toast.success("Saved 💜");
    if (qNum < 3) nav({ to: "/vote/$q", params: { q: String(qNum + 1) } });
    else nav({ to: "/tea" });
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28">
        {/* progress */}
        <div className="flex gap-2 mb-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`h-1.5 flex-1 rounded-full transition-all ${n <= qNum ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>

        <div className="glass-card p-5 animate-fade-up">
          <div className="text-xs font-semibold text-muted-foreground">
            Question {qNum} of 3 · Group {chosenGroup}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold mt-1">
            <span className="mr-2">{question.emoji}</span>{question.label}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Pick exactly one. You can change this any time before results unlock.</p>
        </div>

        <div className="mt-4 sticky top-16 z-10">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search name or roll number…"
            className="w-full px-4 py-3 rounded-2xl bg-white/85 backdrop-blur border border-border focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="mt-3 space-y-2">
          {loading && <div className="text-center text-muted-foreground py-8">Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div className="text-center text-muted-foreground py-6">No matches.</div>
          )}
          {filtered.map((s, i) => {
            const isSel = selected === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left animate-fade-up
                  ${isSel
                    ? "bg-gradient-to-r from-[oklch(0.92_0.07_305)] to-[oklch(0.92_0.07_220)] border-primary shadow-[var(--shadow-card)]"
                    : "bg-white/75 border-border hover:bg-white"}`}
                style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}
              >
                <span className="font-semibold">{s.name}</span>
                <span className="text-xs font-mono text-muted-foreground bg-muted/60 px-2 py-1 rounded-full">{s.roll_number}</span>
              </button>
            );
          })}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background to-transparent">
          <div className="max-w-2xl mx-auto flex gap-3">
            {qNum > 1 && (
              <Link to="/vote/$q" params={{ q: String(qNum - 1) }} className="px-5 py-3 rounded-full bg-white/90 border border-border font-semibold">
                ← Back
              </Link>
            )}
            <button
              disabled={!selected || saving}
              onClick={submit}
              className="pastel-btn flex-1 disabled:opacity-50"
            >
              {saving ? "Saving…" : qNum < 3 ? "Save & next →" : "Save & spill tea →"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
