import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import { runAgentFn } from "../../../inngest/runAgent";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [runAgentFn],
});
