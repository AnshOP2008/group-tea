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

type Student = {
  id: string;
  name: string;
  roll_number: string;
  group_number: number;
};

type Vote = {
  question: number;
  voted_for: string;
  group_number: number;
};

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
  commentCount: number;
};

async function attachScores(rows: Tea[]): Promise<TeaWithScore[]> {
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const did = getDeviceId();

  const [
    { data: votes },
    { data: comments }
  ] = await Promise.all([
    supabase
      .from("tea_upvotes")
      .select("tea_id,device_id,value")
      .in("tea_id", ids),

    supabase
      .from("tea_comments")
      .select("tea_id,deleted")
      .in("tea_id", ids)
  ]);

  const upMap = new Map<
    string,
    {
      up: number;
      down: number;
      mine: number;
      comments: number;
    }
  >();

  for (const id of ids) {
    upMap.set(id, {
      up: 0,
      down: 0,
      mine: 0,
      comments: 0,
    });
  }

  for (const v of votes || []) {
    const e = upMap.get(v.tea_id)!;

    if (v.value > 0) e.up++;
    else e.down++;

    if (v.device_id === did) e.mine = v.value;
  }

  for (const c of comments || []) {
    if (c.deleted) continue;

    const e = upMap.get(c.tea_id);
    if (e) e.comments++;
  }

  return rows.map((r) => {
    const e = upMap.get(r.id)!;

    return {
      ...r,
      up: e.up,
      down: e.down,
      score: e.up - e.down,
      myVote: e.mine,
      commentCount: e.comments,
    };
  });
}
