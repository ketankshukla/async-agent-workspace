import { describe, expect, it, vi } from "vitest";
import type { Message } from "@anthropic-ai/sdk/resources/messages";
import { MAX_ITERATIONS, MAX_ITERATIONS_FALLBACK_MESSAGE, runAgentIterations, type StepLike } from "./agentLoop";

// A pass-through "step" that just runs the function immediately, with no
// checkpointing — good enough to exercise the loop logic in isolation.
const passThroughStep: StepLike = {
  run: (_id, fn) => fn(),
};

function makeToolUseMessage(id: string): Message {
  return {
    id: `msg_${id}`,
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5",
    content: [
      {
        type: "tool_use",
        id,
        name: "fetch_url",
        input: { url: "https://example.com" },
      },
    ],
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  } as unknown as Message;
}

function makeFinalMessage(text: string): Message {
  return {
    id: "msg_final",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  } as unknown as Message;
}

describe("runAgentIterations", () => {
  it("stops after MAX_ITERATIONS when the model always requests a tool call", async () => {
    let callCount = 0;
    const createMessage = vi.fn(async () => {
      callCount++;
      return makeToolUseMessage(`tool_${callCount}`);
    });
    const executeTool = vi.fn(async () => ({ ok: true, output: "some result" }));

    const result = await runAgentIterations([{ role: "user", content: "task" }], {
      step: passThroughStep,
      createMessage,
      executeTool,
    });

    expect(createMessage).toHaveBeenCalledTimes(MAX_ITERATIONS);
    expect(result.iterations).toBe(MAX_ITERATIONS);
    expect(result.finalAnswer).toBe(MAX_ITERATIONS_FALLBACK_MESSAGE);
  });

  it("stops early once the model returns a final text answer", async () => {
    const createMessage = vi
      .fn()
      .mockResolvedValueOnce(makeToolUseMessage("tool_1"))
      .mockResolvedValueOnce(makeFinalMessage("Here is the answer."));
    const executeTool = vi.fn(async () => ({ ok: true, output: "some result" }));

    const result = await runAgentIterations([{ role: "user", content: "task" }], {
      step: passThroughStep,
      createMessage,
      executeTool,
    });

    expect(createMessage).toHaveBeenCalledTimes(2);
    expect(result.iterations).toBe(2);
    expect(result.finalAnswer).toBe("Here is the answer.");
  });

  it("respects a custom maxIterations override", async () => {
    const createMessage = vi.fn(async () => makeToolUseMessage("tool_x"));
    const executeTool = vi.fn(async () => ({ ok: true, output: "result" }));

    const result = await runAgentIterations([{ role: "user", content: "task" }], {
      step: passThroughStep,
      createMessage,
      executeTool,
      maxIterations: 2,
    });

    expect(createMessage).toHaveBeenCalledTimes(2);
    expect(result.iterations).toBe(2);
  });
});
