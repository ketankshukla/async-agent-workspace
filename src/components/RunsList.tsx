"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../lib/supabase/browser";
import type { Run } from "../lib/types";

const STATUS_STYLES: Record<Run["status"], string> = {
  queued: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  running: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export function RunsList({
  selectedRunId,
  onSelect,
  refreshKey,
}: {
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
  refreshKey: number;
}) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRuns() {
      setLoading(true);
      const { data, error: fetchError } = await supabaseBrowser
        .from("runs")
        .select("*")
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setRuns((data as Run[]) ?? []);
        setError(null);
      }
      setLoading(false);
    }

    loadRuns();

    const channel = supabaseBrowser
      .channel("runs-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "runs" },
        (payload) => {
          setRuns((prev) => [payload.new as Run, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "runs" },
        (payload) => {
          const updated = payload.new as Run;
          setRuns((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabaseBrowser.removeChannel(channel);
    };
  }, [refreshKey]);

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading runs…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">Failed to load runs: {error}</p>;
  }

  if (runs.length === 0) {
    return <p className="text-sm text-zinc-500">No runs yet. Submit a task to get started.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {runs.map((run) => (
        <li key={run.id}>
          <button
            onClick={() => onSelect(run.id)}
            className={`flex w-full flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-colors ${
              selectedRunId === run.id
                ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
                : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {run.task}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[run.status]}`}
              >
                {run.status}
              </span>
            </div>
            <span className="text-xs text-zinc-500">
              {new Date(run.created_at).toLocaleString()}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
