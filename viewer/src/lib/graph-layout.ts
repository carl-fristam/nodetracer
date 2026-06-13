import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { TraceGraph, TraceNode } from "../types/trace";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;

// Group consecutive siblings into stages by whether they have sub-children.
// Nodes that spawn children (agent/tool nodes) are "containers" and run in parallel
// within their stage. Leaf nodes are sequential steps.
function groupIntoStages(siblings: TraceNode[], allNodes: Record<string, TraceNode>): TraceNode[][] {
  const hasChildren = (id: string) =>
    Object.values(allNodes).some((n) => n.parent_id === id);

  const stages: TraceNode[][] = [];
  let current: TraceNode[] = [];
  let currentIsContainer: boolean | null = null;

  for (const node of siblings) {
    const isContainer = hasChildren(node.id);
    if (currentIsContainer === null || isContainer === currentIsContainer) {
      current.push(node);
      currentIsContainer = isContainer;
    } else {
      stages.push(current);
      current = [node];
      currentIsContainer = isContainer;
    }
  }
  if (current.length > 0) stages.push(current);
  return stages;
}

export function layoutGraph(trace: TraceGraph): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 60, nodesep: 40, marginx: 20, marginy: 20 });

  for (const node of Object.values(trace.nodes)) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  const childrenByParent = new Map<string, TraceNode[]>();
  for (const node of Object.values(trace.nodes)) {
    if (node.parent_id && trace.nodes[node.parent_id]) {
      const siblings = childrenByParent.get(node.parent_id) ?? [];
      siblings.push(node);
      childrenByParent.set(node.parent_id, siblings);
    }
  }

  // For dagre layout: wire up stage chains so dagre ranks stages top-to-bottom.
  for (const [parentId, siblings] of childrenByParent) {
    const ordered = [...siblings].sort((a, b) => a.sequence_number - b.sequence_number);
    const stages = groupIntoStages(ordered, trace.nodes);

    // Parent → first node of first stage
    g.setEdge(parentId, stages[0][0].id);

    // Within each stage: chain siblings for dagre positioning
    for (const stage of stages) {
      for (let i = 0; i < stage.length - 1; i++) {
        g.setEdge(stage[i].id, stage[i + 1].id);
      }
    }

    // Between stages: last of stage[n] → first of stage[n+1]
    for (let s = 0; s < stages.length - 1; s++) {
      g.setEdge(stages[s][stages[s].length - 1].id, stages[s + 1][0].id);
    }
  }

  // Add explicit trace edges as layout hints
  for (const edge of trace.edges) {
    if (!g.hasEdge(edge.source_id, edge.target_id)) {
      g.setEdge(edge.source_id, edge.target_id);
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

  const addEdge = (source: string, target: string, edgeType: string, label?: string) => {
    const key = `${source}→${target}`;
    if (renderedPairs.has(key)) return;
    renderedPairs.add(key);
    edges.push({
      id: `${edgeType}-${source}-${target}`,
      source,
      target,
      type: "graphEdge",
      data: { edgeType, label },
    });
  };

  for (const [parentId, siblings] of childrenByParent) {
    const ordered = [...siblings].sort((a, b) => a.sequence_number - b.sequence_number);
    const stages = groupIntoStages(ordered, trace.nodes);

    // Parent → first node of first stage (structural entry point)
    addEdge(parentId, stages[0][0].id, "structural");

    for (let s = 0; s < stages.length; s++) {
      const stage = stages[s];
      const nextStage = stages[s + 1];

      if (nextStage) {
        if (stage.length === 1 && nextStage.length > 1) {
          // Fan-out: one node spawns multiple parallel nodes
          for (const next of nextStage) {
            addEdge(stage[0].id, next.id, "sequence");
          }
        } else if (stage.length > 1 && nextStage.length === 1) {
          // Fan-in: multiple parallel nodes converge into one
          for (const node of stage) {
            addEdge(node.id, nextStage[0].id, "sequence");
          }
        } else if (stage.length > 1 && nextStage.length > 1) {
          // Parallel group → parallel group: chain last→first
          addEdge(stage[stage.length - 1].id, nextStage[0].id, "sequence");
        } else {
          // Sequential singleton → singleton
          addEdge(stage[0].id, nextStage[0].id, "sequence");
        }
      }

      // Within a parallel stage (multiple containers): chain with sequence arrows
      if (stage.length > 1) {
        for (let i = 0; i < stage.length - 1; i++) {
          addEdge(stage[i].id, stage[i + 1].id, "sequence");
        }
      }
    }
  }

  // Explicit semantic edges from trace data
  for (const edge of trace.edges) {
    if (edge.edge_type === "caused_by") continue;
    addEdge(edge.source_id, edge.target_id, edge.edge_type, edge.edge_type.replace(/_/g, " "));
  }

  return { nodes, edges };
}
