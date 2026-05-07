import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Countdown } from "@/components/Countdown";
import { getUnlockTime } from "@/lib/settings";
import { getChosenGroup } from "@/lib/device";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [unlock, setUnlock] = useState<Date | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  useEffect(() => {
    getUnlockTime().then(setUnlock);
    setChosen(getChosenGroup());
  }, []);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-3xl mx-auto px-4 pt-10 pb-20">
        <section className="text-center animate-fade-up">
          <div className="inline-block animate-float text-6xl mb-4">🍵</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
            Spill the tea, gently.
          </h1>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            Get to know your group one last time — vote on three questions and drop one anonymous tea. See where your batch stands when results unlock.
          </p>
          <div className="mt-6 flex justify-center">
            <Countdown target={unlock} />
          </div>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            {chosen ? (
              <Link to="/vote/$q" params={{ q: "1" }} className="pastel-btn">
                Continue voting · Group {chosen}
              </Link>
            ) : (
              <Link to="/group" className="pastel-btn">Pick your group →</Link>
            )}
            <Link to="/results" className="px-6 py-3 rounded-full bg-white/70 border border-border font-semibold hover:bg-white transition">
              Peek at results
            </Link>
          </div>
        </section>

        <section className="mt-14 grid sm:grid-cols-3 gap-4">
          {[
            { e: "🌸", t: "Cutest", d: "One vote, no take-backs" },
            { e: "🧠", t: "Smartest", d: "Quietly genius" },
            { e: "🎉", t: "Masti Khor", d: "The chaos coordinator" },
          ].map((c, i) => (
            <div key={i} className="glass-card p-5 animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="text-3xl">{c.e}</div>
              <div className="mt-2 font-display text-xl font-bold">{c.t}</div>
              <div className="text-sm text-muted-foreground">{c.d}</div>
            </div>
          ))}
        </section>

        <section className="mt-10 glass-card p-6 animate-fade-up">
          <h2 className="font-display text-2xl font-bold">How it works</h2>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Pick your group (1–24). One pick per device.</li>
            <li>Answer 3 quick questions — change your mind any time before unlock.</li>
            <li>Drop one anonymous tea (max 150 chars). No take-backs.</li>
            <li>Wait for the timer, then watch the rankings drop. ✨</li>
          </ol>
        </section>
      </main>
    </div>
  );
}
