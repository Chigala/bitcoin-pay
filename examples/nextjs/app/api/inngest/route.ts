/**
 * Inngest API route
 *
 * This endpoint is used by Inngest to execute background functions for
 * monitoring Bitcoin payments.
 */

import { serve } from "inngest/next";
import { inngest, functions } from "@/lib/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  functions: functions as any,
});
