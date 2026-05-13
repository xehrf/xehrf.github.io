import { useEffect, useState } from "react";
import { apiFetch } from "../api/client.js";

/**
 * Subscribes to /stats/arena and re-polls every `refreshMs`.
 *
 * Returns:
 *   {
 *     stats: {
 *       online: number,
 *       matches_today: number,
 *       matches_total: number,
 *       users_total: number,
 *       avg_wait_seconds: number|null,
 *       pts_spread: number|null,
 *     } | null,
 *     loading: boolean,
 *     error: Error|null,
 *   }
 *
 * Pass `refreshMs = 0` to disable auto-refresh (single fetch on mount).
 */
export function useArenaStats({ refreshMs = 30_000 } = {}) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    let timer = null;

    async function fetchOnce() {
      try {
        const data = await apiFetch("/stats/arena");
        if (!mounted) return;
        setStats(data);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setError(e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchOnce();

    if (refreshMs > 0) {
      timer = setInterval(fetchOnce, refreshMs);
    }

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [refreshMs]);

  return { stats, loading, error };
}

/**
 * Formats an `avg_wait_seconds` value into a short label.
 * 27 → "~27s", 95 → "~1m 35s", null → "—".
 */
export function formatWait(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  if (seconds < 60) return `~${Math.max(1, Math.round(seconds))}s`;
  const mins = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return remainder === 0 ? `~${mins}m` : `~${mins}m ${remainder}s`;
}

/**
 * Formats a PTS spread value: 150 → "±150", null → "—".
 */
export function formatSpread(spread) {
  if (spread == null || Number.isNaN(spread)) return "—";
  return `±${Math.round(spread).toLocaleString("ru-RU")}`;
}
