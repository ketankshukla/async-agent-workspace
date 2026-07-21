import type { ContentBlock, Message, MessageParam } from "@anthropic-ai/sdk/resources/messages";

export const MAX_ITERATIONS = 6;

export const MAX_ITERATIONS_FALLBACK_MESSAGE =
  "(reached maximum iterations without a final answer; see step trace for details)";

// A minimal shape compatible with Inngest's `step.run(id, fn)`, so this loop
// can be driven by the real Inngest step tools in production and by a plain
// pass-through implementation in tests (no checkpointing needed there).
export interface StepLike {
  run<T>(id: string, fn: () => Promise<T>): Promise<T>;
}

export type ToolUseBlock = Extract<ContentBlock, { type: "tool_use" }>;

export interface RunAgentIterationsDeps {
  step: StepLike;
  /** Calls the model with the running message history and returns its response. */
  createMessage: (messages: MessageParam[]) => Promise<Message>;
  /** Executes a single tool call and returns its string result (never throws; catch internally). */
  executeTool: (name: string, input: Record<string, unknown>) => Promise<{ ok: boolean; output: string }>;
  onToolCall?: (
    iterationIndex: number,
    toolUse: ToolUseBlock
  ) => Promise<void>;
  onToolResult?: (
    iterationIndex: number,
    toolUse: ToolUseBlock,
    result: { ok: boolean; output: string }
  ) => Promise<void>;
  maxIterations?: number;
}

export interface RunAgentIterationsResult {
  finalAnswer: string;
  iterations: number;
  messages: MessageParam[];
}

function extractText(content: ContentBlock[]): string {
  return content
    .filter((b): b is ContentBlock & { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/**
 * Runs the bounded tool-use loop against the model: each iteration may call a
 * tool (fed back into the conversation) or return a final text answer. Stops
 * after `maxIterations` iterations even if the model keeps requesting tools.
 */
export async function runAgentIterations(
  initialMessages: MessageParam[],
  deps: RunAgentIterationsDeps
): Promise<RunAgentIterationsResult> {
  const maxIterations = deps.maxIterations ?? MAX_ITERATIONS;
  const messages: MessageParam[] = [...initialMessages];

  let finalAnswer: string | null = null;
  let iterations = 0;

  for (let i = 0; i < maxIterations && finalAnswer === null; i++) {
    iterations++;

    const response = await deps.step.run(`iter-${i}`, () => deps.createMessage(messages));

    const toolUseBlocks = response.content.filter(
      (b): b is ToolUseBlock => b.type === "tool_use"
    );

    messages.push({ role: "assistant", content: response.content });

    if (toolUseBlocks.length === 0 || response.stop_reason !== "tool_use") {
      const text = extractText(response.content);
      finalAnswer = text || "(agent returned no final text)";
      break;
    }

    const toolResultContent: Array<{
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }> = [];

    for (const toolUse of toolUseBlocks) {
      if (deps.onToolCall) {
        await deps.step.run(`insert-tool-call-${i}-${toolUse.id}`, () =>
          deps.onToolCall!(i, toolUse)
        );
      }

      const result = await deps.step.run(`tool-exec-${i}-${toolUse.id}`, () =>
        deps.executeTool(toolUse.name, toolUse.input as Record<string, unknown>)
      );

      if (deps.onToolResult) {
        await deps.step.run(`insert-tool-result-${i}-${toolUse.id}`, () =>
          deps.onToolResult!(i, toolUse, result)
        );
      }

      toolResultContent.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result.output,
        is_error: !result.ok,
      });
    }

    messages.push({ role: "user", content: toolResultContent });
  }

  return {
    finalAnswer: finalAnswer ?? MAX_ITERATIONS_FALLBACK_MESSAGE,
    iterations,
    messages,
  };
}
