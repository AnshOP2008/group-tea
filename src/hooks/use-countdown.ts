import { useEffect, useState } from "react";

export function useCountdown(target: Date | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!target) return { ready: false, hh: "--", mm: "--", ss: "--", done: false };
  const diff = Math.max(0, target.getTime() - now);
  const hh = String(Math.floor(diff / 3_600_000)).padStart(2, "0");
  const mm = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, "0");
  const ss = String(Math.floor((diff % 60_000) / 1000)).padStart(2, "0");
  return { ready: true, hh, mm, ss, done: diff === 0 };
}
