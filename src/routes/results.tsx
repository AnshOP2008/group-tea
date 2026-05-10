import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { Countdown } from "@/components/Countdown";
import { supabase } from "@/integrations/supabase/client";
import { getUnlockTime, isUnlockedServer } from "@/lib/settings";
import { getDeviceId } from "@/lib/device";
import { QUESTIONS } from "@/lib/questions";
import { toast } from "sonner";

export const Route = createFileRoute("/results")({
  component: Results,
});

type Student = { id: string; name: string; roll_number: string; group_number: number };
type Vote = { question: number; voted_for: string; group_number: number };
type Tea = { id: string; group_number: number; message: string; created_at: string; priority: number | null; comments_closed: boolean };
type TeaWithScore = Tea & { up: number; down: number; score: number; myVote: number };

function Results() {
  const [unlock, setUnlock] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<number>(1);
  const [tab, setTab] = useState<"q1" | "q2" | "q3" | "tea">("q1");
  const [teaScope, setTeaScope] = useState<"this" | "all">("this");
  const [students, setStudents] = useState<Student[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [tea, setTea] = useState<TeaWithScore[]>([]);
  const [allTea, setAllTea] = useState<TeaWithScore[]>([]);
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

  async function attachScores(rows: Tea[]): Promise<TeaWithScore[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const did = getDeviceId();
    const { data: votes } = await supabase
      .from("tea_upvotes")
      .select("tea_id,device_id,value")
      .in("tea_id", ids);
    const upMap = new Map<string, { up: number; down: number; mine: number }>();
    for (const id of ids) upMap.set(id, { up: 0, down: 0, mine: 0 });
    for (const v of votes || []) {
      const e = upMap.get(v.tea_id)!;
      if (v.value > 0) e.up++; else e.down++;
      if (v.device_id === did) e.mine = v.value;
    }
    return rows.map((r) => {
      const e = upMap.get(r.id)!;
      return { ...r, up: e.up, down: e.down, score: e.up - e.down, myVote: e.mine };
    });
  }

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [s, v, t, ta] = await Promise.all([
      supabase.from("students").select("*").eq("group_number", group),
      supabase.from("votes").select("question,voted_for,group_number").eq("group_number", group),
      supabase.from("tea").select("id,group_number,message,created_at,priority,comments_closed").eq("group_number", group).eq("approved", true).order("created_at", { ascending: false }),
      supabase.from("tea").select("id,group_number,message,created_at,priority,comments_closed").eq("approved", true).order("created_at", { ascending: false }),
    ]);
    setStudents((s.data || []) as Student[]);
    setVotes((v.data || []) as Vote[]);
    const [tw, taw] = await Promise.all([
      attachScores((t.data || []) as Tea[]),
      attachScores((ta.data || []) as Tea[]),
    ]);
    // Sort: admin priority asc (nulls last), then score desc, then newest
    const sorter = (a: TeaWithScore, b: TeaWithScore) => {
      const ap = a.priority ?? Number.POSITIVE_INFINITY;
      const bp = b.priority ?? Number.POSITIVE_INFINITY;
      
      if (b.score !==0 ||  a.score!==0) return b.score + a.score;
      if (ap !== bp) return ap - bp;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    };
    tw.sort(sorter); taw.sort(sorter);
    setTea(tw);
    setAllTea(taw);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  useEffect(() => {
    if (!open) return;
    loadAll();
  }, [group, open, loadAll]);

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
            <TeaList tea={teaScope === "this" ? tea : allTea} showGroup={teaScope === "all"} onChange={loadAll} />
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

function TeaList({ tea, showGroup = false, onChange }: { tea: TeaWithScore[]; showGroup?: boolean; onChange: () => void }) {
  if (tea.length === 0) return <div className="mt-10 text-center text-muted-foreground">No tea served yet ☕</div>;
  return (
    <div className="mt-5 grid sm:grid-cols-2 gap-3">
      {tea.map((t, i) => (
        <TeaCard key={t.id} t={t} index={i} showGroup={showGroup} onVoteChange={onChange} />
      ))}
    </div>
  );
}

type CommentRow = {
  id: string; tea_id: string; parent_id: string | null; message: string;
  created_at: string; device_id: string; deleted: boolean;
};
type CommentNode = CommentRow & { up: number; down: number; score: number; myVote: number; children: CommentNode[] };

function TeaCard({ t, index, showGroup, onVoteChange }: { t: TeaWithScore; index: number; showGroup: boolean; onVoteChange: () => void }) {
  const [up, setUp] = useState(t.up);
  const [down, setDown] = useState(t.down);
  const [myVote, setMyVote] = useState<number>(t.myVote);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState<number>(0);
  const [tree, setTree] = useState<CommentNode[]>([]);
  const [cmt, setCmt] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setUp(t.up); setDown(t.down); setMyVote(t.myVote); }, [t.up, t.down, t.myVote]);

  // Fetch initial comment count on mount
  useEffect(() => {
    supabase
      .from("tea_comments")
      .select("id", { count: "exact", head: true })
      .eq("tea_id", t.id)
      .eq("deleted", false)
      .then(({ count }) => {
        if (count !== null) setCommentCount(count);
      });
  }, [t.id]);

  async function vote(v: 1 | -1) {
    const did = getDeviceId();
    if (myVote === v) {
      // toggle off
      await supabase.from("tea_upvotes").delete().eq("tea_id", t.id).eq("device_id", did);
      if (v === 1) setUp((n) => n - 1); else setDown((n) => n - 1);
      setMyVote(0);
    } else if (myVote === 0) {
      await supabase.from("tea_upvotes").insert({ tea_id: t.id, device_id: did, value: v });
      if (v === 1) setUp((n) => n + 1); else setDown((n) => n + 1);
      setMyVote(v);
    } else {
      // switch
      await supabase.from("tea_upvotes").update({ value: v }).eq("tea_id", t.id).eq("device_id", did);
      if (v === 1) { setUp((n) => n + 1); setDown((n) => Math.max(0, n - 1)); }
      else { setDown((n) => n + 1); setUp((n) => Math.max(0, n - 1)); }
      setMyVote(v);
    }
    // onVoteChange();
    setTimeout(() => {
      onVoteChange();
    }, 120000);
  }

  async function loadComments() {
    const did = getDeviceId();
    const [{ data: cs }, { data: cvs }] = await Promise.all([
      supabase.from("tea_comments")
        .select("id,tea_id,parent_id,message,created_at,device_id,deleted")
        .eq("tea_id", t.id)
        .order("created_at", { ascending: true }),
      // we'll filter in JS by comment ids
      supabase.from("tea_comment_votes").select("comment_id,device_id,value"),
    ]);
    const all: CommentRow[] = (cs || []) as CommentRow[];
    // Hide deleted comments AND any descendants (whole subtree gone for users)
    const byId = new Map(all.map((c) => [c.id, c]));
    function isHiddenByAncestor(c: CommentRow): boolean {
      let cur: CommentRow | undefined = c;
      while (cur) {
        if (cur.deleted) return true;
        if (!cur.parent_id) return false;
        cur = byId.get(cur.parent_id);
      }
      return false;
    }
    const visible = all.filter((c) => !isHiddenByAncestor(c));
    const visibleIds = new Set(visible.map((c) => c.id));
    const voteMap = new Map<string, { up: number; down: number; mine: number }>();
    for (const id of visibleIds) voteMap.set(id, { up: 0, down: 0, mine: 0 });
    for (const v of cvs || []) {
      if (!visibleIds.has(v.comment_id)) continue;
      const e = voteMap.get(v.comment_id)!;
      if (v.value > 0) e.up++; else e.down++;
      if (v.device_id === did) e.mine = v.value;
    }
    const nodes: CommentNode[] = visible.map((c) => {
      const e = voteMap.get(c.id)!;
      return { ...c, up: e.up, down: e.down, score: e.up - e.down, myVote: e.mine, children: [] };
    });
    const map = new Map(nodes.map((n) => [n.id, n]));
    const roots: CommentNode[] = [];
    for (const n of nodes) {
      if (n.parent_id && map.has(n.parent_id)) map.get(n.parent_id)!.children.push(n);
      else roots.push(n);
    }
    function sortRec(arr: CommentNode[]) {
      arr.sort((a, b) => b.score - a.score || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      for (const c of arr) sortRec(c.children);
    }
    sortRec(roots);
    setTree(roots);
  }

  useEffect(() => { if (showComments) loadComments(); /* eslint-disable-next-line */ }, [showComments]);

  async function postComment(parentId: string | null, text: string) {
    if (!text.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("tea_comments").insert({
      tea_id: t.id,
      device_id: getDeviceId(),
      message: text.trim().slice(0, 300),
      parent_id: parentId,
    });
    setBusy(false);
    if (error) { toast.error("Couldn't post"); return; }
    if (parentId === null) setCmt("");
    setCommentCount((c) => c + 1); // Increment count dynamically
    loadComments();
  }

  const score = up - down;

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

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center rounded-full border border-border bg-white/70 overflow-hidden">
          <button
            onClick={() => vote(1)}
            className={`px-3 py-1.5 text-sm font-semibold transition ${myVote === 1 ? "bg-[oklch(0.85_0.15_25)] text-white" : "hover:bg-white"}`}
            aria-label="Upvote"
          >
            {myVote === 1 ? "❤️" : "🤍"} {up}
          </button>
          <span className={`px-2 text-xs font-bold ${score > 0 ? "text-[oklch(0.5_0.18_25)]" : score < 0 ? "text-muted-foreground" : "text-muted-foreground"}`}>
            {score > 0 ? `+${score}` : score}
          </span>
          <button
            onClick={() => vote(-1)}
            className={`px-3 py-1.5 text-sm font-semibold transition ${myVote === -1 ? "bg-[oklch(0.6_0.15_260)] text-white" : "hover:bg-white"}`}
            aria-label="Downvote"
          >
            ⬇ {down}
          </button>
        </div>
        <button
          onClick={() => setShowComments((s) => !s)}
          className="px-3 py-1.5 rounded-full text-sm font-semibold bg-white/70 border border-border"
        >
          💬 {commentCount} {showComments ? "Hide" : "Comments"}
        </button>
      </div>

      {showComments && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {tree.length === 0 && <div className="text-xs text-muted-foreground">No comments yet.</div>}
            {tree.map((c) => (
              <CommentItem
                key={c.id}
                node={c}
                depth={0}
                onChange={loadComments}
                onReply={(pid, text) => postComment(pid, text)}
                disabled={t.comments_closed}
              />
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
              <button onClick={() => postComment(null, cmt)} disabled={busy || !cmt.trim()} className="pastel-btn text-sm disabled:opacity-50">
                Post
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommentItem({ node, depth, onChange, onReply, disabled }: {
  node: CommentNode;
  depth: number;
  onChange: () => void;
  onReply: (parentId: string, text: string) => void;
  disabled: boolean;
}) {
  const [up, setUp] = useState(node.up);
  const [down, setDown] = useState(node.down);
  const [myVote, setMyVote] = useState<number>(node.myVote);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");

  useEffect(() => { setUp(node.up); setDown(node.down); setMyVote(node.myVote); }, [node.up, node.down, node.myVote]);

  async function vote(v: 1 | -1) {
    const did = getDeviceId();
    if (myVote === v) {
      await supabase.from("tea_comment_votes").delete().eq("comment_id", node.id).eq("device_id", did);
      if (v === 1) setUp((n) => n - 1); else setDown((n) => n - 1);
      setMyVote(0);
    } else if (myVote === 0) {
      await supabase.from("tea_comment_votes").insert({ comment_id: node.id, device_id: did, value: v });
      if (v === 1) setUp((n) => n + 1); else setDown((n) => n + 1);
      setMyVote(v);
    } else {
      await supabase.from("tea_comment_votes").update({ value: v }).eq("comment_id", node.id).eq("device_id", did);
      if (v === 1) { setUp((n) => n + 1); setDown((n) => Math.max(0, n - 1)); }
      else { setDown((n) => n + 1); setUp((n) => Math.max(0, n - 1)); }
      setMyVote(v);
    }
    onChange();
  }

  const score = up - down;
  const indent = Math.min(depth, 4) * 12;

  return (
    <div style={{ marginLeft: indent }} className="border-l-2 border-border/60 pl-2">
      <div className="text-sm bg-white/60 rounded-xl px-3 py-2">
        <div>{node.message}</div>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground">{new Date(node.created_at).toLocaleString()}</span>
          <div className="inline-flex items-center rounded-full border border-border bg-white/70 overflow-hidden">
            <button onClick={() => vote(1)} className={`px-2 py-0.5 text-xs font-semibold ${myVote === 1 ? "bg-[oklch(0.85_0.15_25)] text-white" : ""}`}>
              {myVote === 1 ? "❤️" : "🤍"} {up}
            </button>
            <span className="px-1 text-[10px] font-bold">{score > 0 ? `+${score}` : score}</span>
            <button onClick={() => vote(-1)} className={`px-2 py-0.5 text-xs font-semibold ${myVote === -1 ? "bg-[oklch(0.6_0.15_260)] text-white" : ""}`}>
              ⬇ {down}
            </button>
          </div>
          {!disabled && (
            <button onClick={() => setReplying((s) => !s)} className="text-[11px] underline text-muted-foreground">
              {replying ? "Cancel" : "Reply"}
            </button>
          )}
        </div>
        {replying && !disabled && (
          <div className="mt-2 flex gap-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value.slice(0, 300))}
              placeholder="Reply…"
              className="flex-1 px-2 py-1 rounded-full bg-white/90 border border-border text-xs"
            />
            <button
              onClick={() => { onReply(node.id, replyText); setReplyText(""); setReplying(false); }}
              disabled={!replyText.trim()}
              className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
            >
              Post
            </button>
          </div>
        )}
      </div>
      {node.children.length > 0 && (
        <div className="mt-1 space-y-1">
          {node.children.map((c) => (
            <CommentItem key={c.id} node={c} depth={depth + 1} onChange={onChange} onReply={onReply} disabled={disabled} />
          ))}
        </div>
      )}
    </div>
  );
}
