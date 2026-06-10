import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { TraceGraph, TraceNode } from "../types/trace";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;

export function layoutGraph(trace: TraceGraph): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 50, nodesep: 40, marginx: 20, marginy: 20 });

  for (const node of Object.values(trace.nodes)) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Group siblings by parent and sort by sequence_number to build sequence chains.
  // This turns a star (parent→all children) into a flow (parent→first→second→…→last),
  // giving dagre the sequential structure needed to lay out traces as flows.
  const childrenByParent = new Map<string, TraceNode[]>();
  for (const node of Object.values(trace.nodes)) {
    if (node.parent_id && trace.nodes[node.parent_id]) {
      const siblings = childrenByParent.get(node.parent_id) ?? [];
      siblings.push(node);
      childrenByParent.set(node.parent_id, siblings);
    }
  }

  const sequenceEdges = new Set<string>(); // "srcId→tgtId"

  for (const [parentId, siblings] of childrenByParent) {
    const ordered = [...siblings].sort((a, b) => a.sequence_number - b.sequence_number);

    // Connect parent → first child
    g.setEdge(parentId, ordered[0].id);

    // Chain siblings sequentially
    for (let i = 0; i < ordered.length - 1; i++) {
      const src = ordered[i].id;
      const tgt = ordered[i + 1].id;
      g.setEdge(src, tgt);
      sequenceEdges.add(`${src}→${tgt}`);
    }
  }

  // Add explicit edges as additional layout hints (skip duplicates)
  for (const edge of trace.edges) {
    const key = `${edge.source_id}→${edge.target_id}`;
    if (!g.hasEdge(edge.source_id, edge.target_id)) {
      g.setEdge(edge.source_id, edge.target_id);
      sequenceEdges.add(key);
    }
  }

  dagre.layout(g);

  const nodes: Node[] = Object.values(trace.nodes).map((node) => {
    const pos = g.node(node.id);
    const isRoot = !node.parent_id;
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
        isRoot,
      },
      style: { width: NODE_WIDTH },
    };
  });

  const edges: Edge[] = [];
  const renderedPairs = new Set<string>();

  // Sequence edges between siblings — rendered as subtle flow arrows
  for (const [parentId, siblings] of childrenByParent) {
    const ordered = [...siblings].sort((a, b) => a.sequence_number - b.sequence_number);

    // Parent → first child (structural)
    const firstKey = `${parentId}→${ordered[0].id}`;
    renderedPairs.add(firstKey);
    edges.push({
      id: `structural-${parentId}-${ordered[0].id}`,
      source: parentId,
      target: ordered[0].id,
      type: "graphEdge",
      data: { edgeType: "structural" },
    });

    for (let i = 0; i < ordered.length - 1; i++) {
      const src = ordered[i].id;
      const tgt = ordered[i + 1].id;
      const key = `${src}→${tgt}`;
      renderedPairs.add(key);
      edges.push({
        id: `seq-${src}-${tgt}`,
        source: src,
        target: tgt,
        type: "graphEdge",
        data: { edgeType: "sequence" },
      });
    }
  }

  // Semantic edges only — caused_by is a structural parent→child link already
  // represented by the sequence chain above; rendering it adds noise.
  for (const edge of trace.edges) {
    if (edge.edge_type === "caused_by") continue;
    const key = `${edge.source_id}→${edge.target_id}`;
    if (!renderedPairs.has(key)) {
      renderedPairs.add(key);
      edges.push({
        id: `edge-${edge.source_id}-${edge.target_id}-${edge.edge_type}`,
        source: edge.source_id,
        target: edge.target_id,
        type: "graphEdge",
        data: {
          edgeType: edge.edge_type,
          label: edge.edge_type.replace(/_/g, " "),
        },
      });
    }
  }

  return { nodes, edges };
}
