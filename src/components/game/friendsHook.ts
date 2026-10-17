"use client";

import { useCallback, useEffect, useState } from "react";
import type { FriendsOverview } from "@/game/friends";
import { fetchFriends } from "@/game/persist";

export interface FriendsState {
  data: FriendsOverview | null;
  failed: boolean;
  pending: number;
  reload: () => Promise<void>;
}

/** Friend summaries and incoming-request count refresh once per minute while visible. */
export function useFriends(userId: string | null): FriendsState {
  const [snapshot, setSnapshot] = useState<{ userId: string; data: FriendsOverview } | null>(null);
  const [failedUserId, setFailedUserId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    const data = await fetchFriends();
    if (data) {
      setSnapshot({ userId, data });
      setFailedUserId(null);
    } else setFailedUserId(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const load = async () => {
      const data = await fetchFriends();
      if (!alive) return;
      if (data) {
        setSnapshot({ userId, data });
        setFailedUserId(null);
      } else setFailedUserId(userId);
    };
    void load();
    const timer = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") void load();
    }, 60_000);
    return () => { alive = false; clearInterval(timer); };
  }, [userId]);

  const data = userId && snapshot?.userId === userId ? snapshot.data : null;
  return {
    data,
    failed: !!userId && failedUserId === userId,
    pending: data?.incoming.length ?? 0,
    reload,
  };
}
