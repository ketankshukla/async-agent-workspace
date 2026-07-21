"use client";

import { useState } from "react";
import { NewTaskForm } from "../components/NewTaskForm";
import { RunsList } from "../components/RunsList";
import { RunDetail } from "../components/RunDetail";

export default function Home() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleCreated(runId: string) {
    setSelectedRunId(runId);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10 sm:px-10">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Async Agent Workspace
          </h1>
          <p className="text-sm text-zinc-500">
            Submit a research task, watch it run in the background, and see each step stream in
            live.
          </p>
        </header>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <NewTaskForm onCreated={handleCreated} />
        </section>

        <section className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Runs
            </h2>
            <RunsList
              selectedRunId={selectedRunId}
              onSelect={setSelectedRunId}
              refreshKey={refreshKey}
            />
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            {selectedRunId ? (
              <RunDetail runId={selectedRunId} />
            ) : (
              <p className="text-sm text-zinc-500">Select a run to see its live trace.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
