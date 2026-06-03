/** Format a duration in milliseconds to a human-readable string. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = ((ms % 60_000) / 1000).toFixed(1);
  return `${mins}m ${secs}s`;
}

/**
 * Format the offset between a node start and a trace start.
 * Returns e.g. "+120ms" or "+1.23s".
 */
export function formatOffset(
  nodeTime: string | null | undefined,
  traceStart: string | null | undefined,
): string {
  if (!nodeTime || !traceStart) return "";
  const delta = new Date(nodeTime).getTime() - new Date(traceStart).getTime();
  if (delta < 0) return "";
  return `+${formatDuration(delta)}`;
}

/** Format an ISO timestamp to a short human-readable string. */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

/** Format an ISO timestamp to a date string for list display. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
