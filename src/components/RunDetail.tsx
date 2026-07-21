"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../lib/supabase/browser";
import type { Run, RunStep } from "../lib/types";

const TYPE_LABELS: Record<RunStep["type"], string> = {
  plan: "Plan",
  tool_call: "Tool call",
  tool_result: "Tool result",
  final: "Final answer",
  error: "Error",
};

const TYPE_STYLES: Record<RunStep["type"], string> = {
  plan: "border-zinc-300 dark:border-zinc-700",
  tool_call: "border-blue-300 dark:border-blue-700",
  tool_result: "border-emerald-300 dark:border-emerald-700",
  final: "border-zinc-900 dark:border-zinc-100",
  error: "border-red-400 dark:border-red-600",
};

export function RunDetail({ runId }: { runId: string }) {
  const [run, setRun] = useState<Run | null>(null);
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRunAndSteps() {
      setLoading(true);
      setError(null);

      const [runRes, stepsRes] = await Promise.all([
        supabaseBrowser.from("runs").select("*").eq("id", runId).single(),
        supabaseBrowser
          .from("run_steps")
          .select("*")
          .eq("run_id", runId)
          .order("idx", { ascending: true }),
      ]);

      if (!isMounted) return;

      if (runRes.error) {
        setError(runRes.error.message);
      } else {
        setRun(runRes.data as Run);
      }

      if (stepsRes.error) {
        setError((prev) => prev ?? stepsRes.error!.message);
      } else {
        setSteps((stepsRes.data as RunStep[]) ?? []);
      }

      setLoading(false);
    }

    loadRunAndSteps();

    const channel = supabaseBrowser
      .channel(`run-detail-${runId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "run_steps", filter: `run_id=eq.${runId}` },
        (payload) => {
          const newStep = payload.new as RunStep;
          setSteps((prev) =>
            prev.some((s) => s.id === newStep.id)
              ? prev
              : [...prev, newStep].sort((a, b) => a.idx - b.idx)
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "runs", filter: `id=eq.${runId}` },
        (payload) => {
          setRun(payload.new as Run);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabaseBrowser.removeChannel(channel);
    };
  }, [runId]);

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading run…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">Failed to load run: {error}</p>;
  }

  if (!run) {
    return <p className="text-sm text-zinc-500">Run not found.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{run.task}</h2>
        <p className="text-xs text-zinc-500">
          Status: <span className="font-medium">{run.status}</span> · Created{" "}
          {new Date(run.created_at).toLocaleString()}
        </p>
      </div>

      {steps.length === 0 ? (
        <p className="text-sm text-zinc-500">Waiting for the first step…</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {steps.map((step) => (
            <li
              key={step.id}
              className={`rounded-lg border-l-4 bg-zinc-50 px-3 py-2 dark:bg-zinc-900 ${TYPE_STYLES[step.type]}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {TYPE_LABELS[step.type]}: {step.title}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {new Date(step.created_at).toLocaleTimeString()}
                </span>
              </div>
              {step.detail && (
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-zinc-600 dark:text-zinc-400">
                  {step.detail}
                </pre>
              )}
            </li>
          ))}
        </ol>
      )}

      {run.status === "failed" && run.error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
          <strong>Run failed:</strong> {run.error}
        </div>
      )}

      {run.status === "completed" && run.final_answer && (
        <div className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-300">
          <strong>Final answer:</strong>
          <p className="mt-1 whitespace-pre-wrap">{run.final_answer}</p>
        </div>
      )}
    </div>
  );
}
