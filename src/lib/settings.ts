import { supabase } from "@/integrations/supabase/client";

export async function getUnlockTime(): Promise<Date | null> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "results_unlock_at").maybeSingle();
  if (!data?.value) return null;
  return new Date(data.value);
}

export function isUnlocked(t: Date | null): boolean {
  if (!t) return false;
  return Date.now() >= t.getTime();
}
