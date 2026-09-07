import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Clearer errors when Supabase edge functions are missing or unreachable */
export function formatEdgeFunctionError(error: unknown, functionName: string): string {
  const msg = error instanceof Error ? error.message : String(error ?? "Unknown error");
  if (
    msg.includes("Failed to send a request to the Edge Function") ||
    msg.includes("Failed to fetch") ||
    error instanceof FunctionsFetchError ||
    error instanceof FunctionsRelayError
  ) {
    return (
      `Edge Function "${functionName}" is not reachable. ` +
      `Deploy it to your Supabase project: bash scripts/deploy-edge-functions.sh`
    );
  }
  if (error instanceof FunctionsHttpError) {
    return `Edge Function "${functionName}" returned an error. Check Supabase → Edge Functions → Logs.`;
  }
  if (msg.toLowerCase().includes("not found") || msg.includes("404")) {
    return `Edge Function "${functionName}" is not deployed yet. Run: supabase functions deploy ${functionName}`;
  }
  return msg;
}

export async function invokeEdgeFunction<T = any>(
  functionName: string,
  options?: { body?: Record<string, unknown> }
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: options?.body,
    });
    if (error) {
      // Prefer JSON error body from the function when present
      const bodyErr = data && typeof data === "object" && "error" in (data as object)
        ? String((data as any).error)
        : null;
      return { data: null, error: bodyErr || formatEdgeFunctionError(error, functionName) };
    }
    if (data && typeof data === "object" && (data as any).error) {
      return { data: null, error: String((data as any).error) };
    }
    return { data: data as T, error: null };
  } catch (e) {
    return { data: null, error: formatEdgeFunctionError(e, functionName) };
  }
}
