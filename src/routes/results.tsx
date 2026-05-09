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

type Tea = {
  id: string;
  group_number: number;
  message: string;
  created_at: string;
  priority: number | null;
  comments_closed: boolean;
};

type TeaWithScore = Tea & {
  up: number;
  down: number;
  score: number;
  myVote: number;
  commentCount?: number;
};

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
  }, []);

  useEffect(() => {
    if (unlock) isUnlockedServer(unlock).then((ok) => setOpen(ok));
  }, [unlock]);

  useEffect(() => {
    supabase.from("students").select("*").then(({ data }) => {
      setAllStudents((data || []) as Student[]);
    });
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
      if (v.value > 0) e.up++;
      else e.down++;
      if (v.device_id === did) e.mine = v.value;
    }

    return rows.map((r) => {
      const e = upMap.get(r.id)!;
      return {
        ...r,
        up: e.up,
        down: e.down,
        score: e.up - e.down,
        myVote: e.mine,
      };
    });
  }

  const loadAll = useCallback(async () => {
    setLoading(true);

    const [s, v, t, ta, commentsRes] = await Promise.all([
      supabase.from("students").select("*").eq("group_number", group),
      supabase.from("votes").select("question,voted_for,group_number").eq("group_number", group),
      supabase
        .from("tea")
        .select("id,group_number,message,created_at,priority,comments_closed")
        .eq("group_number", group)
        .eq("approved", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("tea")
        .select("id,group_number,message,created_at,priority,comments_closed")
        .eq("approved", true)
        .order("created_at", { ascending: false }),
      supabase.from("tea_comments").select("tea_id"),
    ]);

    setStudents((s.data || []) as Student[]);
    setVotes((v.data || []) as Vote[]);

    const commentMap = new Map<string, number>();
    for (const c of commentsRes.data || []) {
      commentMap.set(c.tea_id, (commentMap.get(c.tea_id) || 0) + 1);
    }

    const [twRaw, tawRaw] = await Promise.all([
      attachScores((t.data || []) as Tea[]),
      attachScores((ta.data || []) as Tea[]),
    ]);

    const addComments = (arr: TeaWithScore[]) =>
      arr.map((t) => ({
        ...t,
        commentCount: commentMap.get(t.id) || 0,
      }));

    const sorter = (a: TeaWithScore, b: TeaWithScore) => {
      const ap = a.priority ?? Number.POSITIVE_INFINITY;
      const bp = b.priority ?? Number.POSITIVE_INFINITY;

      if (b.score !== a.score) return b.score - a.score;
      if (ap !== bp) return ap - bp;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    };

    const tw = addComments(twRaw).sort(sorter);
    const taw = addComments(tawRaw).sort(sorter);

    setTea(tw);
    setAllTea(taw);
    setLoading(false);
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
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.roll_number.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [studentSearch, allStudents]);

  if (!open) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="max-w-xl mx-auto px-4 pt-16 pb-20 text-center">
          <div className="text-6xl animate-float mb-4">🔒</div>
          <h1 className="font-display text-3xl font-bold">Results are still brewing</h1>
          <div className="mt-5 flex justify-center">
            <Countdown target={unlock} />
          </div>
        </main>
      </div>
    );
  }

  const qIdx = tab === "tea" ? null : Number(tab[1]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-20">

        {loading ? (
          <div className="mt-10 text-center">Loading…</div>
        ) : tab === "tea" ? (
          <TeaList tea={teaScope === "this" ? tea : allTea} />
        ) : (
          <div>Rankings here</div>
        )}

      </main>
    </div>
  );
}

function TeaList({ tea }: { tea: TeaWithScore[] }) {
  return (
    <div className="grid gap-3">
      {tea.map((t) => (
        <div key={t.id} className="p-3 border rounded-xl bg-white">
          <div>{t.message}</div>
          <div className="text-xs text-muted-foreground mt-1">
            💬 {t.commentCount || 0} comments
          </div>
        </div>
      ))}
    </div>
  );
}
