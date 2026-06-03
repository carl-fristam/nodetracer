import type { TraceGraph, TraceNode, Edge } from "../types/trace";
import type { TimeMode } from "../App";

export interface TraceOriginMap {
  nodeToTrace: Map<string, string>;
  traceOrder: string[];
  traceNames: Map<string, string>;
}

export function mergeTraces(
  traces: TraceGraph[],
  timeMode: TimeMode,
): { merged: TraceGraph; origins: TraceOriginMap } {
  const nodeToTrace = new Map<string, string>();
  const traceNames = new Map<string, string>();
  const traceOrder = traces.map((t) => t.trace_id);

  const mergedNodes: Record<string, TraceNode> = {};
  const mergedEdges: Edge[] = [];

  // For normalized mode, find the earliest start time across all traces
  let globalStart: number | null = null;
  if (timeMode === "normalized") {
    for (const trace of traces) {
      if (trace.start_time) {
        const t = new Date(trace.start_time).getTime();
        if (globalStart === null || t < globalStart) globalStart = t;
      }
    }
  }

  for (const trace of traces) {
    traceNames.set(trace.trace_id, trace.name || trace.trace_id);

    const traceStartMs =
      timeMode === "normalized" && globalStart !== null && trace.start_time
        ? new Date(trace.start_time).getTime() - globalStart
        : 0;

    for (const [nodeId, node] of Object.entries(trace.nodes)) {
      const prefixedId = `${trace.trace_id}::${nodeId}`;
      nodeToTrace.set(prefixedId, trace.trace_id);

      let startTime = node.start_time;
      let endTime = node.end_time;

      if (timeMode === "normalized" && traceStartMs !== 0) {
        startTime = startTime
          ? new Date(new Date(startTime).getTime() - traceStartMs).toISOString()
          : null;
        endTime = endTime
          ? new Date(new Date(endTime).getTime() - traceStartMs).toISOString()
          : null;
      }

      mergedNodes[prefixedId] = {
        ...node,
        id: prefixedId,
        parent_id: node.parent_id ? `${trace.trace_id}::${node.parent_id}` : null,
        start_time: startTime,
        end_time: endTime,
      };
    }

    for (const edge of trace.edges) {
      mergedEdges.push({
        source_id: `${trace.trace_id}::${edge.source_id}`,
        target_id: `${trace.trace_id}::${edge.target_id}`,
        edge_type: edge.edge_type,
      });
    }
  }

  // Earliest start / latest end across all traces for the merged trace
  const starts = traces.map((t) => t.start_time).filter(Boolean) as string[];
  const ends = traces.map((t) => t.end_time).filter(Boolean) as string[];
  const mergedStart = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : null;
  const mergedEnd = ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : null;

  const merged: TraceGraph = {
    schema_version: traces[0]?.schema_version ?? "1",
    trace_id: traces.map((t) => t.trace_id).join("+"),
    name: traces.map((t) => t.name || t.trace_id).join(" + "),
    nodes: mergedNodes,
    edges: mergedEdges,
    start_time: mergedStart,
    end_time: mergedEnd,
    duration_ms:
      mergedStart && mergedEnd
        ? new Date(mergedEnd).getTime() - new Date(mergedStart).getTime()
        : null,
    metadata: {},
  };

  return { merged, origins: { nodeToTrace, traceOrder, traceNames } };
}
