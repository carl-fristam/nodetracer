import type { TraceGraph, TraceSummary } from "../types/trace";

const BASE = "/api";

export async function fetchTraces(): Promise<TraceSummary[]> {
  const res = await fetch(`${BASE}/traces`);
  if (!res.ok) throw new Error(`Failed to fetch traces: ${res.statusText}`);
  return res.json();
}

export async function fetchTrace(id: string): Promise<TraceGraph> {
  const res = await fetch(`${BASE}/traces/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch trace ${id}: ${res.statusText}`);
  return res.json();
}
