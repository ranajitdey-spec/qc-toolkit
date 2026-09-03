/**
 * Single hook point for a future logging/analytics system.
 *
 * Today this does nothing but a console write in dev. When you want real
 * logging later (who used which tool, when, for a second user etc.), swap
 * the body of this one function — point it at a Cloudflare Worker + KV,
 * a Supabase insert, whatever — and every tool that already calls
 * logEvent() starts reporting without any other code changing.
 *
 * Call it from a tool at the moment something meaningful happens
 * (e.g. "ran the compressor", "generated a table"), not on every keystroke.
 */
export function logEvent(toolId: string, action: string, meta?: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.debug(`[log] ${toolId}:${action}`, meta ?? {});
  }
  // Intentionally no-op in production until a real backend exists.
}
