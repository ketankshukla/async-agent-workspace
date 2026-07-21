import { inngest } from "../../../inngest/client";
import { supabaseAdmin } from "../../../lib/supabase/admin";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const task = (body as { task?: unknown } | null)?.task;

  if (typeof task !== "string" || task.trim().length === 0) {
    return Response.json({ error: '"task" must be a non-empty string' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("runs")
      .insert({ task: task.trim(), status: "queued" })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create run");
    }

    const runId = data.id as string;

    await inngest.send({
      name: "agent/run.requested",
      data: { runId, task: task.trim() },
    });

    return Response.json({ runId }, { status: 201 });
  } catch (err) {
    console.error("Failed to enqueue run:", err);
    return Response.json({ error: "Failed to enqueue run" }, { status: 500 });
  }
}
