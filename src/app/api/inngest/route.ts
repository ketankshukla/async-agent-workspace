import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";

// The agent function will be added here in Phase 7.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [],
});
