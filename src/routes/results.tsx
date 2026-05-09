import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Countdown } from "@/components/Countdown";
import { supabase } from "@/integrations/supabase/client";
import { getUnlockTime, isUnlockedServer } from "@/lib/settings";
import { QUESTIONS } from "@/lib/questions";
import { toast } from "sonner";

export const Route = createFileRoute("/results")({
  component: Results,
});

type Student = { id: string; name: string; roll_number: string; group_number: number };
type Vote = { question: number; voted_for: string; group_number: number };
type Tea = { id: string; group_number: number; message: string; created_at: string; priority: number | null; comments_closed: boolean };

function Results() {
  const [unlock, setUnlock] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<number>(1);
  const [tab, setTab] = useState<"q1" | "q2" | "q3" | "tea">("q1");
  const [teaScope, setTeaScope] = useState<"this" | "all">("this");
  const [students, setStudents] = useState<Student[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [tea, setTea] = useState<Tea[]>([]);
  const [allTea, setAllTea] = useState<Tea[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentSearch, setStudentSearch] = useState("");
  const [allStudents, setAllStudents] = useState<Student[]>([]);

  useEffect(() => {
    getUnlockTime().then(async (t) => {
      setUnlock(t);
      setOpen(await isUnlockedServer(t));
    });
    const id = setInterval(async () => {
      if (!unlock) return;
      const ok = await isUnlockedServer(unlock);
      setOpen((prev) => prev || ok);
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (unlock) isUnlockedServer(unlock).then((ok) => setOpen(ok));
  }, [unlock]);

  useEffect(() => {
    supabase.from("students").select("*").then(({ data }) => setAllStudents((data || []) as Student[]));
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      supabase.from("students").select("*").eq("group_number", group),
      supabase.from("votes").select("question,voted_for,group_number").eq("group_number", group),
      supabase.from("tea").select("id,group_number,message,created_at,priority,comments_closed").eq("group_number", group).eq("approved", true).order("priority", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
      supabase.from("tea").select("id,group_number,message,created_at,priority,comments_closed").eq("approved", true).order("priority", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
    ]).then(([s, v, t, ta]) => {
      setStudents((s.data || []) as Student[]);
      setVotes((v.data || []) as Vote[]);
      setTea((t.data || []) as Tea[]);
      setAllTea((ta.data || []) as Tea[]);
      setLoading(false);
    });
  }, [group, open]);

  const rankings = useMemo(() => {
    const byQ: Record<number, { student: Student; count: number }[]> = {};
    for (const q of [1, 2, 3]) {
      const counts = new Map<string, number>();
      for (const v of votes.filter((x) => x.question === q)) {
        counts.set(v.voted_for, (counts.get(v.voted_for) || 0) + 1);
      }
      const list = students
        .map((s) => ({ student: s, count: counts.get(s.id) || 0 }))
        .sort((a, b) => b.count - a.count);
      byQ[q] = list;
    }
    return byQ;
  }, [votes, students]);

  const studentMatches = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return [];
    return allStudents
      .filter((s) => s.name.toLowerCase().includes(q) || s.roll_number.toLowerCase().includes(q))
      .slice(0, 6);
  }, [studentSearch, allStudents]);

  if (!open) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="max-w-xl mx-auto px-4 pt-16 pb-20 text-center">
          <div className="text-6xl animate-float mb-4">🔒</div>
          <h1 className="font-display text-3xl font-bold">Results are still brewing</h1>
          <p className="text-muted-foreground mt-2">Come back when the timer hits zero.</p>
          <div className="mt-5 flex justify-center"><Countdown target={unlock} /></div>
        </main>
      </div>
    );
  }

  const qIdx = tab === "tea" ? null : Number(tab[1]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-20">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs text-muted-foreground font-semibold">Showing</div>
            <h1 className="font-display text-3xl font-bold">Group {group}</h1>
          </div>
          <select
            value={group}
            onChange={(e) => setGroup(Number(e.target.value))}
            className="px-4 py-2.5 rounded-full bg-white/85 border border-border font-semibold"
          >
            {Array.from({ length: 24 }, (_, i) => i + 1).map((g) => (
              <option key={g} value={g}>Group {g}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 relative">
          <input
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            placeholder="🔍 Search any student to jump to their group…"
            className="w-full px-4 py-3 rounded-2xl bg-white/85 border border-border"
          />
          {studentMatches.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 glass-card overflow-hidden">
              {studentMatches.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setGroup(s.group_number); setStudentSearch(""); }}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-white"
                >
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-xs text-muted-foreground">Group {s.group_number}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {(["q1", "q2", "q3", "tea"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                tab === t ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]" : "bg-white/70 border border-border"
              }`}
            >
              {t === "tea" ? "☕ Tea" : `${QUESTIONS[Number(t[1]) - 1].emoji} Q${t[1]}`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-10 text-center text-muted-foreground">Loading…</div>
        ) : tab === "tea" ? (
          <>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setTeaScope("this")}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition ${teaScope === "this" ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]" : "bg-white/70 border border-border"}`}
              >
                This group
              </button>
              <button
                onClick={() => setTeaScope("all")}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition ${teaScope === "all" ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]" : "bg-white/70 border border-border"}`}
              >
                All groups
              </button>
            </div>
            <TeaList tea={teaScope === "this" ? tea : allTea} showGroup={teaScope === "all"} />
          </>
        ) : (
          <RankingList list={rankings[qIdx!]} title={QUESTIONS[qIdx! - 1].label} emoji={QUESTIONS[qIdx! - 1].emoji} />
        )}
      </main>
    </div>
  );
}

function RankingList({ list, title, emoji }: { list: { student: Student; count: number }[]; title: string; emoji: string }) {
  const total = list.reduce((s, r) => s + r.count, 0);
  const max = Math.max(1, list[0]?.count || 0);
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <section className="mt-6">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl">{emoji}</span>
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        <span className="ml-auto chip">Rankings</span>
      </div>

      <div className="mt-4 space-y-2">
        {list.map((r, i) => {
          const pct = total ? Math.round((r.count / total) * 100) : 0;
          const barPct = max ? (r.count / max) * 100 : 0;
          const isTop3 = i < 3 && r.count > 0;
          return (
            <div
              key={r.student.id}
              className={`relative overflow-hidden rounded-2xl p-4 animate-fade-up border ${
                isTop3 ? "bg-gradient-to-r from-[oklch(0.95_0.06_85)] to-[oklch(0.95_0.06_305)] border-[oklch(0.85_0.08_85)]" : "bg-white/80 border-border"
              }`}
              style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
            >
              <div
                className="absolute inset-y-0 left-0 opacity-40"
                style={{
                  width: `${barPct}%`,
                  background: "linear-gradient(90deg, oklch(0.92 0.07 305), oklch(0.92 0.07 220))",
                  transition: "width 0.6s ease",
                }}
              />
              <div className="relative flex items-center gap-3">
                <div className="w-9 text-center font-display font-bold text-lg">
                  {isTop3 ? medals[i] : `#${i + 1}`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.student.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{r.student.roll_number}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-xl font-bold">{r.count}</div>
                  <div className="text-xs text-muted-foreground">{pct}%</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TeaList({ tea, showGroup = false }: { tea: Tea[]; showGroup?: boolean }) {
  if (tea.length === 0) return <div className="mt-10 text-center text-muted-foreground">No tea served yet ☕</div>;
  return (
    <div className="mt-5 grid sm:grid-cols-2 gap-3">
      {tea.map((t, i) => (
        <TeaCard key={t.id} t={t} index={i} showGroup={showGroup} />
      ))}
    </div>
  );
}

function TeaCard({ t, index, showGroup }: { t: Tea; index: number; showGroup: boolean }) {
  const [upCount, setUpCount] = useState(0);
  const [upvoted, setUpvoted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<{ id: string; message: string; created_at: string; device_id: string }[]>([]);
  const [cmt, setCmt] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadUpvotes() {
    const deviceId = (await import("@/lib/device")).getDeviceId();
    const [{ count }, { data: mine }] = await Promise.all([
      supabase.from("tea_upvotes").select("id", { count: "exact", head: true }).eq("tea_id", t.id),
      supabase.from("tea_upvotes").select("id").eq("tea_id", t.id).eq("device_id", deviceId).maybeSingle(),
    ]);
    setUpCount(count ?? 0);
    setUpvoted(!!mine);
  }

  async function loadComments() {
    const { data } = await supabase
      .from("tea_comments")
      .select("id,message,created_at,device_id")
      .eq("tea_id", t.id)
      .order("created_at", { ascending: true });
    setComments(data || []);
  }

  useEffect(() => { loadUpvotes(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (showComments) loadComments(); /* eslint-disable-next-line */ }, [showComments]);

  async function toggleUpvote() {
    const { getDeviceId } = await import("@/lib/device");
    const deviceId = getDeviceId();
    if (upvoted) {
      await supabase.from("tea_upvotes").delete().eq("tea_id", t.id).eq("device_id", deviceId);
    } else {
      await supabase.from("tea_upvotes").insert({ tea_id: t.id, device_id: deviceId });
    }
    loadUpvotes();
  }

  async function postComment() {
    if (!cmt.trim()) return;
    setBusy(true);
    const { getDeviceId } = await import("@/lib/device");
    const { error } = await supabase.from("tea_comments").insert({
      tea_id: t.id,
      device_id: getDeviceId(),
      message: cmt.trim().slice(0, 300),
    });
    setBusy(false);
    if (error) { toast.error("Couldn't post"); return; }
    setCmt("");
    loadComments();
  }

  return (
    <div className="glass-card p-4 animate-fade-up" style={{ animationDelay: `${index * 30}ms` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-lg">#{index + 1}</span>
          <span className="text-2xl">☕</span>
        </div>
        {showGroup && <span className="chip text-xs">Group {t.group_number}</span>}
      </div>
      <p className="mt-1 leading-snug">{t.message}</p>
      <div className="mt-2 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={toggleUpvote}
          className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition ${
            upvoted ? "bg-[oklch(0.85_0.15_25)] text-white border-transparent" : "bg-white/70 border-border"
          }`}
        >
          {upvoted ? "❤️" : "🤍"} {upCount}
        </button>
        <button
          onClick={() => setShowComments((s) => !s)}
          className="px-3 py-1.5 rounded-full text-sm font-semibold bg-white/70 border border-border"
        >
          💬 {showComments ? "Hide" : "Comments"}
        </button>
      </div>

      {showComments && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {comments.length === 0 && <div className="text-xs text-muted-foreground">No comments yet.</div>}
            {comments.map((c) => (
              <div key={c.id} className="text-sm bg-white/60 rounded-xl px-3 py-2">
                <div>{c.message}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{new Date(c.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
          {t.comments_closed ? (
            <div className="mt-2 text-xs text-muted-foreground">🔒 Comments are closed.</div>
          ) : (
            <div className="mt-2 flex gap-2">
              <input
                value={cmt}
                onChange={(e) => setCmt(e.target.value.slice(0, 300))}
                placeholder="Write a comment…"
                className="flex-1 px-3 py-2 rounded-full bg-white/90 border border-border text-sm"
              />
              <button onClick={postComment} disabled={busy || !cmt.trim()} className="pastel-btn text-sm disabled:opacity-50">
                Post
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
