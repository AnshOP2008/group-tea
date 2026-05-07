import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { getChosenGroup, getDeviceId, hasSubmittedTea, markTeaSubmitted } from "@/lib/device";
import { toast } from "sonner";

export const Route = createFileRoute("/tea")({
  component: TeaSubmit,
});

function TeaSubmit() {
  const nav = useNavigate();
  const [group, setGroup] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const g = getChosenGroup();
    if (!g) { nav({ to: "/group" }); return; }
    setGroup(g);
    if (hasSubmittedTea()) setSubmitted(true);
    // confirm with server
    (async () => {
      const { data } = await supabase.from("tea").select("id").eq("device_id", getDeviceId()).maybeSingle();
      if (data) { markTeaSubmitted(); setSubmitted(true); }
    })();
  }, [nav]);

  async function send() {
    if (!group || !msg.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("tea").insert({
      device_id: getDeviceId(),
      group_number: group,
      message: msg.trim().slice(0, 150),
    });
    setBusy(false);
    if (error) {
      if (error.code === "23505") {
        toast("You've already submitted tea — only one per device 💜");
        markTeaSubmitted();
        setSubmitted(true);
      } else {
        toast.error("Couldn't submit. Try again.");
      }
      return;
    }
    markTeaSubmitted();
    setSubmitted(true);
    toast.success("Tea steeped ☕ — pending review");
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-20">
        <div className="glass-card p-6 animate-fade-up">
          <div className="text-xs font-semibold text-muted-foreground">Group {group} · Anonymous</div>
          <h1 className="font-display text-3xl font-bold mt-1">Spill one tea ☕</h1>
          <p className="text-muted-foreground text-sm mt-1">
            One message per device. 150 character max. No edits, no take-backs. Be playful, not toxic — moderators review before publishing.
          </p>

          {submitted ? (
            <div className="mt-5 p-4 rounded-2xl bg-[oklch(0.93_0.07_160)]/60 border border-[oklch(0.85_0.1_160)]">
              ✅ Your tea is in. It'll appear on the results page once approved.
            </div>
          ) : (
            <>
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value.slice(0, 150))}
                placeholder="The funniest, sweetest, weirdest thing about your group…"
                rows={4}
                className="mt-5 w-full px-4 py-3 rounded-2xl bg-white/90 border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
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
