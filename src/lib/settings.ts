import { supabase } from "@/integrations/supabase/client";
import { getServerNow } from "@/lib/time.functions";

export async function getUnlockTime(): Promise<Date | null> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "results_unlock_at").maybeSingle();
  if (!data?.value) return null;
  return new Date(data.value);
}

// Cache server-time offset (server_now - client_now) so we don't hit the
// server every tick. Refresh periodically.
let _offsetMs: number | null = null;
let _lastFetched = 0;

async function getServerOffset(): Promise<number> {
  const stale = Date.now() - _lastFetched > 60_000;
  if (_offsetMs !== null && !stale) return _offsetMs;
  try {
    const t0 = Date.now();
    const { now } = await getServerNow();
    const t1 = Date.now();
    // Approximate server time at the midpoint of the round trip
    const clientMid = (t0 + t1) / 2;
    _offsetMs = now - clientMid;
    _lastFetched = Date.now();
  } catch {
    if (_offsetMs === null) _offsetMs = 0;
  }
  return _offsetMs;
}

export async function serverNow(): Promise<number> {
  const offset = await getServerOffset();
  return Date.now() + offset;
}

export async function isUnlockedServer(t: Date | null): Promise<boolean> {
  if (!t) return false;
  const now = await serverNow();
  return now >= t.getTime();
}

// Sync version using the cached offset (after a prior call). Falls back to
// client time if offset hasn't been fetched yet — safe because pages also
// call the async check on mount.
export function isUnlocked(t: Date | null): boolean {
  if (!t) return false;
  const offset = _offsetMs ?? 0;
  return Date.now() + offset >= t.getTime();
}
