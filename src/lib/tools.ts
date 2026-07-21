import * as cheerio from "cheerio";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_TEXT_LENGTH = 6000;

/**
 * Fetches a URL and extracts readable text from the HTML using cheerio.
 * Truncates long pages and throws clear, descriptive errors on failure.
 */
export async function fetchUrl(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: "${url}"`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `Unsupported URL protocol "${parsed.protocol}". Only http and https are allowed.`
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "async-agent-workspace/1.0 (+fetch_url tool)",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Fetching "${url}" timed out after ${FETCH_TIMEOUT_MS}ms`);
    }
    throw new Error(
      `Failed to fetch "${url}": ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch "${url}": HTTP ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, nav, footer, header").remove();

  const text = $("body").text().replace(/\s+/g, " ").trim();

  if (!text) {
    throw new Error(`No readable text content found at "${url}"`);
  }

  return text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH)}…` : text;
}

// Anthropic `tools` schema for the fetch_url tool.
export const toolDefinitions = [
  {
    name: "fetch_url",
    description:
      "Fetches a web page and returns its readable text content (HTML stripped, truncated to ~6000 characters). Use this to research a URL relevant to the task.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "The absolute URL to fetch, including http:// or https://",
        },
      },
      required: ["url"],
    },
  },
];

/**
 * Dispatches a tool call by name. Throws on unknown tool names.
 */
export async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "fetch_url": {
      const url = input.url;
      if (typeof url !== "string") {
        throw new Error('fetch_url tool requires a string "url" input');
      }
      return fetchUrl(url);
    }
    default:
      throw new Error(`Unknown tool: "${name}"`);
  }
}
