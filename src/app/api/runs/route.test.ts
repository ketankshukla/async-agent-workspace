import { describe, expect, it, vi, beforeEach } from "vitest";

const fromMock = vi.fn();
const sendMock = vi.fn();

vi.mock("../../../lib/supabase/admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

vi.mock("../../../inngest/client", () => ({
  inngest: { send: sendMock },
}));

describe("POST /api/runs", () => {
  beforeEach(() => {
    fromMock.mockReset();
    sendMock.mockReset();
  });

  it("rejects an empty task without touching the database or enqueueing a job", async () => {
    const { POST } = await import("./route");

    const request = new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/non-empty string/i);
    expect(fromMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects a missing task field", async () => {
    const { POST } = await import("./route");

    const request = new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const { POST } = await import("./route");

    const request = new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
