import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlock, MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { inngest } from "./client";
import { supabaseAdmin } from "../lib/supabase/admin";
import { toolDefinitions, runTool } from "../lib/tools";
import { runAgentIterations, type ToolUseBlock } from "../lib/agentLoop";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function insertStep(
  runId: string,
  idx: number,
  type: "plan" | "tool_call" | "tool_result" | "final" | "error",
  title: string,
  detail?: string
) {
  const { error } = await supabaseAdmin.from("run_steps").insert({
    run_id: runId,
    idx,
    type,
    title,
    detail: detail ?? null,
  });
  if (error) {
    throw new Error(`Failed to insert run_steps row: ${error.message}`);
  }
}

export const runAgentFn = inngest.createFunction(
  { id: "run-agent", retries: 3, triggers: [{ event: "agent/run.requested" }] },
  async ({ event, step }) => {
    const { runId, task } = event.data as { runId: string; task: string };
    let stepIdx = 0;

    try {
      await step.run("mark-running", async () => {
        const { error } = await supabaseAdmin
          .from("runs")
          .update({ status: "running", updated_at: new Date().toISOString() })
          .eq("id", runId);
        if (error) throw new Error(`Failed to mark run as running: ${error.message}`);
      });

      const planText = await step.run("plan", async () => {
        const anthropic = getAnthropicClient();
        const planMessage = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 512,
          messages: [
            {
              role: "user",
              content: `You are a research agent. Task: "${task}"\n\nBriefly (2-4 sentences) describe your plan for researching and answering this task. You have access to a fetch_url tool to read web pages.`,
            },
          ],
        });
        const text = planMessage.content
          .filter((b: ContentBlock) => b.type === "text")
          .map((b) => (b as { text: string }).text)
          .join("\n");
        return text || "(no plan text returned)";
      });

      await step.run("insert-plan-step", async () => {
        await insertStep(runId, stepIdx++, "plan", "Plan", planText);
      });

      const initialMessages: MessageParam[] = [
        {
          role: "user",
          content: `Task: "${task}"\n\nYour plan: ${planText}\n\nNow work through the task. Use the fetch_url tool if you need to read a web page. When you are done, provide your final answer as plain text with no further tool calls.`,
        },
      ];

      const { finalAnswer } = await runAgentIterations(initialMessages, {
        // Inngest's real step.run return type is wrapped in `Jsonify<...>` for
        // checkpointing; structurally it still behaves as `run(id, fn): Promise<T>`.
        step: step as unknown as import("../lib/agentLoop").StepLike,
        createMessage: (messages) => {
          const anthropic = getAnthropicClient();
          return anthropic.messages.create({
            model: MODEL,
            max_tokens: 1024,
            tools: toolDefinitions,
            messages,
          });
        },
        executeTool: async (name, input) => {
          try {
            const output = await runTool(name, input);
            return { ok: true, output };
          } catch (err) {
            return { ok: false, output: err instanceof Error ? err.message : String(err) };
          }
        },
        onToolCall: async (_iterationIndex: number, toolUse: ToolUseBlock) => {
          await insertStep(
            runId,
            stepIdx++,
            "tool_call",
            `Calling ${toolUse.name}`,
            JSON.stringify(toolUse.input)
          );
        },
        onToolResult: async (
          _iterationIndex: number,
          toolUse: ToolUseBlock,
          result: { ok: boolean; output: string }
        ) => {
          await insertStep(
            runId,
            stepIdx++,
            "tool_result",
            result.ok ? `Result from ${toolUse.name}` : `Error from ${toolUse.name}`,
            result.output
          );
        },
      });

      await step.run("finalize", async () => {
        await insertStep(runId, stepIdx++, "final", "Final answer", finalAnswer);
        const { error } = await supabaseAdmin
          .from("runs")
          .update({
            status: "completed",
            final_answer: finalAnswer,
            updated_at: new Date().toISOString(),
          })
          .eq("id", runId);
        if (error) throw new Error(`Failed to finalize run: ${error.message}`);
      });

      return { runId, finalAnswer };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      await step.run("mark-failed", async () => {
        await insertStep(runId, stepIdx++, "error", "Run failed", message);
        const { error } = await supabaseAdmin
          .from("runs")
          .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
          .eq("id", runId);
        if (error) {
          throw new Error(`Failed to mark run as failed: ${error.message}`);
        }
      });

      throw err;
    }
  }
);
