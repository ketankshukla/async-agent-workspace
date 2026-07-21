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

  let runId: string;

  try {
    const { data, error } = await supabaseAdmin
      .from("runs")
      .insert({ task: task.trim(), status: "queued" })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create run");
    }

    runId = data.id as string;
  } catch (err) {
    console.error("Failed to create run:", err);
    return Response.json({ error: "Failed to create run" }, { status: 500 });
  }

  try {
    await inngest.send({
      name: "agent/run.requested",
      data: { runId, task: task.trim() },
    });

    return Response.json({ runId }, { status: 201 });
  } catch (err) {
    console.error("Failed to enqueue run:", err);

    // The runs row already exists (status "queued") but no job will ever
    // process it since sending the event failed. Mark it failed so it
    // doesn't linger forever, rather than leaving an orphaned queued run.
    await supabaseAdmin
      .from("runs")
      .update({
        status: "failed",
        error: "Failed to enqueue background job. Is the Inngest Dev Server running?",
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return Response.json({ error: "Failed to enqueue run" }, { status: 500 });
  }
}
