import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { TraceGraph } from "../types/trace";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;

export function layoutGraph(trace: TraceGraph): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 60, nodesep: 30, marginx: 20, marginy: 20 });

  for (const node of Object.values(trace.nodes)) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Layout edges: prefer parent_id relationships, fall back to explicit edges
  for (const node of Object.values(trace.nodes)) {
    if (node.parent_id && trace.nodes[node.parent_id]) {
      g.setEdge(node.parent_id, node.id);
    }
  }
  for (const edge of trace.edges) {
    if (!g.hasEdge(edge.source_id, edge.target_id)) {
      g.setEdge(edge.source_id, edge.target_id);
    }
  }

  dagre.layout(g);

  const nodes: Node[] = Object.values(trace.nodes).map((node) => {
    const pos = g.node(node.id);
    return {
      id: node.id,
      type: "graphNode",
      position: {
        x: pos ? pos.x - NODE_WIDTH / 2 : 0,
        y: pos ? pos.y - NODE_HEIGHT / 2 : 0,
      },
      data: {
        label: node.name,
        nodeType: node.node_type,
        status: node.status,
        durationMs: node.duration_ms,
        error: node.error,
      },
      style: { width: NODE_WIDTH },
    };
  });

  // Structural edges (parent → child)
  const structuralPairs = new Set<string>();
  const edges: Edge[] = [];

  for (const node of Object.values(trace.nodes)) {
    if (node.parent_id && trace.nodes[node.parent_id]) {
      const key = `${node.parent_id}→${node.id}`;
      structuralPairs.add(key);
      edges.push({
        id: `structural-${node.parent_id}-${node.id}`,
        source: node.parent_id,
        target: node.id,
        type: "graphEdge",
        data: { edgeType: "structural" },
      });
    }
  }

  // Explicit non-structural edges
  for (const edge of trace.edges) {
    const key = `${edge.source_id}→${edge.target_id}`;
    if (!structuralPairs.has(key)) {
      edges.push({
        id: `edge-${edge.source_id}-${edge.target_id}-${edge.edge_type}`,
        source: edge.source_id,
        target: edge.target_id,
        type: "graphEdge",
        data: { edgeType: edge.edge_type, label: edge.edge_type },
      });
    }
  }

  return { nodes, edges };
}
