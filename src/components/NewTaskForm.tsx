"use client";

import { useState } from "react";

export function NewTaskForm({ onCreated }: { onCreated: (runId: string) => void }) {
  const [task, setTask] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!task.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: task.trim() }),
      });

      const body = await res.json();

      if (!res.ok) {
        throw new Error(body?.error ?? "Failed to submit task");
      }

      setTask("");
      onCreated(body.runId as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit task");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="task" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        New research task
      </label>
      <div className="flex gap-2">
        <input
          id="task"
          type="text"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="e.g. Summarize the latest Next.js release notes"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={submitting || !task.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
