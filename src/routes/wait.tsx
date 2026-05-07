import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Countdown } from "@/components/Countdown";
import { getUnlockTime, isUnlocked } from "@/lib/settings";

export const Route = createFileRoute("/wait")({
  component: Wait,
});

function Wait() {
  const [t, setT] = useState<Date | null>(null);
  useEffect(() => { getUnlockTime().then(setT); }, []);
  const open = isUnlocked(t);
  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-xl mx-auto px-4 pt-16 pb-20 text-center">
        <div className="text-7xl animate-float mb-4">⏳</div>
        <h1 className="font-display text-3xl font-bold">{open ? "It's time." : "Almost there…"}</h1>
        <p className="text-muted-foreground mt-2">
          {open ? "Results are unlocked — go peek 👀" : "Hang tight — results drop when the timer hits zero."}
        </p>
        <div className="mt-6 flex justify-center"><Countdown target={t} /></div>
        <Link to="/results" className="pastel-btn mt-8 inline-block">{open ? "See results →" : "Try results page"}</Link>
      </main>
    </div>
  );
}
