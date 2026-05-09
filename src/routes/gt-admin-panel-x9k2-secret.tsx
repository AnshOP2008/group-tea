import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/gt-admin-panel-x9k2-secret")({
  component: Admin,
});

type Tea = { id: string; group_number: number; message: string; approved: boolean; rejected: boolean; created_at: string; priority: number | null; comments_closed: boolean };
type Comment = { id: string; tea_id: string; message: string; created_at: string; deleted: boolean; parent_id: string | null };

function Admin() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [check, setCheck] = useState(false);
  const [tea, setTea] = useState<Tea[]>([]);
  const [unlock, setUnlock] = useState<string>("");
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [visits, setVisits] = useState<number | null>(null);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [recentComments, setRecentComments] = useState<(Comment & { tea_message: string; tea_group: number })[]>([]);

  async function tryLogin(e: React.FormEvent) {
    e.preventDefault();
    setCheck(true);
    const { data } = await supabase.from("app_settings").select("value").eq("key", "admin_password").maybeSingle();
    setCheck(false);
    if (data?.value === pw) {
      setAuthed(true);
      load();
    } else {
      toast.error("Wrong password");
    }
  }

  async function load() {
    const [t, s, v] = await Promise.all([
      supabase.from("tea").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("value").eq("key", "results_unlock_at").maybeSingle(),
      supabase.from("site_visits").select("*", { count: "exact", head: true }),
    ]);
    setTea((t.data || []) as Tea[]);
    setVisits(v.count ?? 0);
    if (s.data?.value) {
      const d = new Date(s.data.value);
      const pad = (n: number) => String(n).padStart(2, "0");
      setUnlock(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    } else {
      setUnlock("");
    }
  }

  async function moderate(id: string, approve: boolean, priority?: number | null) {
    const patch: { approved: boolean; rejected: boolean; priority?: number | null } = {
      approved: approve,
      rejected: !approve,
    };
    if (approve) patch.priority = priority ?? null;
    const { error } = await supabase.from("tea").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(approve ? "Approved" : "Rejected"); load(); }
  }

  async function setPriority(id: string, priority: number | null) {
    const { error } = await supabase.from("tea").update({ priority }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Priority updated"); load(); }
  }

  async function saveUnlock() {
    const iso = unlock ? new Date(unlock).toISOString() : null;
    const { error } = await supabase.from("app_settings").update({ value: iso, updated_at: new Date().toISOString() }).eq("key", "results_unlock_at");
    if (error) toast.error(error.message);
    else toast.success("Unlock time saved");
  }

  async function resetAll() {
    if (!confirm("⚠️ DELETE ALL votes, tea, and device locks? This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure? Everyone will start fresh.")) return;
    const [v, t, d, s] = await Promise.all([
      supabase.from("votes").delete().not("id", "is", null),
      supabase.from("tea").delete().not("id", "is", null),
      supabase.from("devices").delete().not("device_id", "is", null),
      supabase.from("app_settings").update({ value: null, updated_at: new Date().toISOString() }).eq("key", "results_unlock_at"),
    ]);
    const err = v.error || t.error || d.error || s.error;
    if (err) toast.error(err.message);
    else {
      try { localStorage.removeItem("gt_device_id"); localStorage.removeItem("gt_chosen_group"); localStorage.removeItem("gt_tea_submitted"); } catch {}
      toast.success("All data wiped 🧼");
      setUnlock("");
      load();
    }
  }

  async function unlockNow() {
    const iso = new Date().toISOString();
    const { error } = await supabase.from("app_settings").update({ value: iso, updated_at: iso }).eq("key", "results_unlock_at");
    if (error) toast.error(error.message);
    else { toast.success("Results unlocked!"); load(); }
  }

  async function lockNow() {
    // Push unlock far into the future to lock results immediately
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
    const { error } = await supabase.from("app_settings").update({ value: future, updated_at: new Date().toISOString() }).eq("key", "results_unlock_at");
    if (error) toast.error(error.message);
    else { toast.success("Results locked 🔒"); load(); }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPw || newPw.length < 4) return toast.error("Password too short");
    if (newPw !== confirmPw) return toast.error("Passwords don't match");
    const { error } = await supabase.from("app_settings").update({ value: newPw, updated_at: new Date().toISOString() }).eq("key", "admin_password");
    if (error) toast.error(error.message);
    else { toast.success("Password updated"); setNewPw(""); setConfirmPw(""); }
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={tryLogin} className="glass-card p-6 w-full max-w-sm">
          <h1 className="font-display text-2xl font-bold">Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter password to continue.</p>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="mt-4 w-full px-4 py-3 rounded-2xl bg-white/90 border border-border"
            placeholder="••••••••"
            autoFocus
          />
          <button disabled={check} className="pastel-btn w-full mt-3">{check ? "Checking…" : "Enter"}</button>
        </form>
      </div>
    );
  }

  const filtered = tea.filter((t) => {
    if (filter === "pending") return !t.approved && !t.rejected;
    if (filter === "approved") return t.approved;
    return t.rejected;
  });

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-bold">GroupTea · Admin</h1>

      <section className="grid sm:grid-cols-3 gap-3 mt-5">
        <div className="glass-card p-4">
          <div className="text-xs text-muted-foreground">Site visits</div>
          <div className="font-display text-3xl font-bold mt-1">{visits ?? "…"}</div>
          <div className="text-xs text-muted-foreground mt-1">Total page loads of the home link</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-xs text-muted-foreground">Tea submitted</div>
          <div className="font-display text-3xl font-bold mt-1">{tea.length}</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-xs text-muted-foreground">Pending moderation</div>
          <div className="font-display text-3xl font-bold mt-1">{tea.filter(t => !t.approved && !t.rejected).length}</div>
        </div>
      </section>

      <section className="glass-card p-5 mt-5">
        <h2 className="font-display text-xl font-bold">⏰ Results unlock time</h2>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            type="datetime-local"
            value={unlock}
            onChange={(e) => setUnlock(e.target.value)}
            className="px-4 py-2.5 rounded-2xl bg-white/90 border border-border flex-1"
          />
          <button onClick={saveUnlock} className="pastel-btn">Save</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={unlockNow} className="px-5 py-2.5 rounded-full bg-[oklch(0.9_0.1_160)] border border-border font-semibold">🔓 Unlock now</button>
          <button onClick={lockNow} className="px-5 py-2.5 rounded-full bg-[oklch(0.92_0.06_260)] border border-border font-semibold">🔒 Lock now</button>
        </div>
      </section>

      <section className="glass-card p-5 mt-5">
        <h2 className="font-display text-xl font-bold">🔑 Change admin password</h2>
        <form onSubmit={changePassword} className="mt-3 flex flex-col sm:flex-row gap-2">
          <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New password" className="px-4 py-2.5 rounded-2xl bg-white/90 border border-border flex-1" />
          <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Confirm" className="px-4 py-2.5 rounded-2xl bg-white/90 border border-border flex-1" />
          <button className="pastel-btn">Update</button>
        </form>
      </section>

      <section className="glass-card p-5 mt-5" style={{ background: "oklch(0.95 0.06 25 / 0.7)" }}>
        <h2 className="font-display text-xl font-bold">🧨 Danger zone</h2>
        <p className="text-sm text-muted-foreground mt-1">Wipes all votes, tea, and device locks. Students data is kept.</p>
        <button onClick={resetAll} className="mt-3 px-5 py-2.5 rounded-full bg-[oklch(0.7_0.2_25)] text-white font-semibold">Reset all data</button>
      </section>

      <section className="mt-6">
        <div className="flex gap-2 flex-wrap">
          {(["pending", "approved", "rejected"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-semibold capitalize ${filter === f ? "bg-primary text-primary-foreground" : "bg-white/70 border border-border"}`}
            >
              {f} ({tea.filter((t) => f === "pending" ? !t.approved && !t.rejected : f === "approved" ? t.approved : t.rejected).length})
            </button>
          ))}
        </div>

        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          {filtered.length === 0 && <div className="text-muted-foreground">Nothing here.</div>}
          {filtered.map((t) => <TeaCard key={t.id} t={t} moderate={moderate} setPriority={setPriority} />)}
        </div>
      </section>
    </div>
  );
}

function TeaCard({
  t,
  moderate,
  setPriority,
}: {
  t: Tea;
  moderate: (id: string, approve: boolean, priority?: number | null) => void;
  setPriority: (id: string, priority: number | null) => void;
}) {
  const [pri, setPri] = useState<string>(t.priority != null ? String(t.priority) : "");
  const [comments, setComments] = useState<Comment[]>([]);
  const [showCmts, setShowCmts] = useState(false);
  const [closed, setClosed] = useState<boolean>(t.comments_closed);

  async function loadComments() {
    const { data } = await supabase
      .from("tea_comments")
      .select("id,tea_id,message,created_at")
      .eq("tea_id", t.id)
      .order("created_at", { ascending: true });
    setComments((data || []) as Comment[]);
  }

  useEffect(() => {
    if (showCmts) loadComments();
    // eslint-disable-next-line
  }, [showCmts]);

  async function deleteComment(id: string) {
    const { error } = await supabase.from("tea_comments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Comment deleted"); loadComments(); }
  }

  async function toggleClosed() {
    const next = !closed;
    const { error } = await supabase.from("tea").update({ comments_closed: next }).eq("id", t.id);
    if (error) toast.error(error.message);
    else { setClosed(next); toast.success(next ? "Comments closed" : "Comments opened"); }
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="chip">Group {t.group_number}</span>
        <span>{new Date(t.created_at).toLocaleString()}</span>
      </div>
      <p className="mt-2">{t.message}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="number"
          value={pri}
          onChange={(e) => setPri(e.target.value)}
          placeholder="Priority #"
          className="w-28 px-3 py-2 rounded-full bg-white/90 border border-border text-sm"
        />
        {!t.approved && (
          <button
            onClick={() => moderate(t.id, true, pri === "" ? null : Number(pri))}
            className="px-4 py-2 rounded-full bg-[oklch(0.9_0.1_160)] font-semibold text-sm"
          >
            ✓ Approve {pri !== "" ? `· #${pri}` : ""}
          </button>
        )}
        {t.approved && (
          <button
            onClick={() => setPriority(t.id, pri === "" ? null : Number(pri))}
            className="px-4 py-2 rounded-full bg-[oklch(0.92_0.06_260)] font-semibold text-sm"
          >
            Save priority
          </button>
        )}
        {!t.rejected && (
          <button
            onClick={() => moderate(t.id, false)}
            className="px-4 py-2 rounded-full bg-[oklch(0.92_0.08_25)] font-semibold text-sm"
          >
            ✗ Reject
          </button>
        )}
        {t.approved && (
          <>
            <button
              onClick={toggleClosed}
              className="px-4 py-2 rounded-full bg-white/80 border border-border font-semibold text-sm"
            >
              {closed ? "🔒 Comments closed" : "💬 Open"}
            </button>
            <button
              onClick={() => setShowCmts((s) => !s)}
              className="px-4 py-2 rounded-full bg-white/80 border border-border font-semibold text-sm"
            >
              {showCmts ? "Hide" : "View"} comments
            </button>
          </>
        )}
      </div>

      {showCmts && (
        <div className="mt-3 border-t border-border pt-3 space-y-2">
          {comments.length === 0 && <div className="text-xs text-muted-foreground">No comments.</div>}
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2 bg-white/60 rounded-xl px-3 py-2">
              <div className="flex-1 text-sm">
                <div>{c.message}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{new Date(c.created_at).toLocaleString()}</div>
              </div>
              <button
                onClick={() => deleteComment(c.id)}
                className="px-2 py-1 rounded-full bg-[oklch(0.92_0.08_25)] text-xs font-semibold"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
