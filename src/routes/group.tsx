import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId, getFingerprint, getChosenGroup, setChosenGroup, isLikelyIncognito } from "@/lib/device";
import { toast } from "sonner";

export const Route = createFileRoute("/group")({
  component: GroupSelect,
});

function GroupSelect() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<number | null>(null);
  const [incog, setIncog] = useState(false);

  useEffect(() => {
    setExisting(getChosenGroup());
    isLikelyIncognito().then(setIncog);
    // also check server-side
    (async () => {
      const id = getDeviceId();
      const { data } = await supabase.from("devices").select("chosen_group").eq("device_id", id).maybeSingle();
      if (data?.chosen_group) {
        setExisting(data.chosen_group);
        setChosenGroup(data.chosen_group);
      }
    })();
  }, []);

  async function pick(g: number) {
    if (existing && existing !== g) {
      toast("You're already locked into Group " + existing + " on this device 💜");
      return;
    }
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
    nav({ to: "/vote/$q", params: { q: "1" } });
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-3xl mx-auto px-4 pt-8 pb-20">
        <div className="animate-fade-up">
          <h1 className="font-display text-3xl font-bold">Which group are you in?</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            You can only participate in one group per device. Choose carefully — this locks for good.
          </p>
        </div>

        {incog && (
          <div className="mt-4 glass-card p-4 text-sm" style={{ background: "oklch(0.95 0.06 95 / 0.7)" }}>
            ⚠️ Looks like you might be in private/incognito mode. Your participation might not stick if you close the tab.
          </div>
        )}

        {existing && (
          <div className="mt-4 glass-card p-4 text-sm">
            You're locked into <b>Group {existing}</b> on this device.{" "}
            <Link to="/vote/$q" params={{ q: "1" }} className="underline font-semibold">Continue voting →</Link>
          </div>
        )}

        <div className="mt-6 grid grid-cols-3 sm:grid-cols-4 gap-3">
          {Array.from({ length: 24 }, (_, i) => i + 1).map((g) => {
            const isPicked = existing === g;
            const disabled = !!existing && existing !== g;
            return (
              <button
                key={g}
                disabled={busy || disabled}
                onClick={() => pick(g)}
                className={`relative aspect-square rounded-2xl font-display text-2xl font-bold transition-all
                  ${isPicked ? "bg-gradient-to-br from-[oklch(0.78_0.13_305)] to-[oklch(0.82_0.1_340)] text-white shadow-[var(--shadow-soft)]" :
                    disabled ? "bg-muted/60 text-muted-foreground" :
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
