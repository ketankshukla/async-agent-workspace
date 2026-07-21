import { describe, expect, it, vi } from "vitest";
import { fetchUrl, runTool } from "./tools";

describe("runTool", () => {
  it("throws on an unknown tool name", async () => {
    await expect(runTool("not_a_real_tool", {})).rejects.toThrow(/unknown tool/i);
  });

  it("throws when fetch_url is called without a string url", async () => {
    await expect(runTool("fetch_url", {})).rejects.toThrow(/requires a string/i);
  });
});

describe("fetchUrl", () => {
  it("rejects an invalid URL before making any network request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(fetchUrl("not-a-valid-url")).rejects.toThrow(/invalid url/i);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("rejects unsupported protocols (e.g. file://) before fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(fetchUrl("file:///etc/passwd")).rejects.toThrow(/unsupported url protocol/i);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("throws a clear error when the network request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network down"));

    await expect(fetchUrl("https://example.com")).rejects.toThrow(/failed to fetch/i);

    vi.restoreAllMocks();
  });

  it("throws a clear error on a non-OK HTTP response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("not found", { status: 404, statusText: "Not Found" })
    );

    await expect(fetchUrl("https://example.com")).rejects.toThrow(/404/);

    vi.restoreAllMocks();
  });
});
