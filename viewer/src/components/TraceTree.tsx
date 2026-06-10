import { useMemo, useState } from "react";
import type { TraceGraph, TraceNode } from "../types/trace";
import { formatDuration, formatOffset } from "../lib/format";
import { StatusIndicator, TypeBadge } from "./NodeBadge";

interface Props {
  trace: TraceGraph;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

interface TreeNodeProps {
  node: TraceNode;
  trace: TraceGraph;
  childrenMap: Map<string | null, TraceNode[]>;
  edgeLabels: Map<string, string[]>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  defaultExpanded: boolean;
}

function buildChildrenMap(trace: TraceGraph): Map<string | null, TraceNode[]> {
  const map = new Map<string | null, TraceNode[]>();
  for (const node of Object.values(trace.nodes)) {
    const key = node.parent_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(node);
  }
  for (const children of map.values()) {
    children.sort((a, b) => a.sequence_number - b.sequence_number);
  }
  return map;
}

function buildEdgeLabels(trace: TraceGraph): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const edge of trace.edges) {
    if (edge.edge_type === "caused_by") continue;
    const targetNode = trace.nodes[edge.target_id];
    if (!targetNode) continue;
    const label = edgeTypeLabel(edge.edge_type, targetNode.name);
    if (!label) continue;
    if (!map.has(edge.source_id)) map.set(edge.source_id, []);
    map.get(edge.source_id)!.push(label);
  }
  return map;
}

function edgeTypeLabel(edgeType: string, targetName: string): string | null {
  switch (edgeType) {
    case "retry_of": return `retry of ${targetName}`;
    case "fallback_of": return `fallback of ${targetName}`;
    case "branched_from": return `branched from ${targetName}`;
    case "data_flow": return `→ ${targetName}`;
    default: return null;
  }
}

function TreeNode({
  node,
  trace,
  childrenMap,
  edgeLabels,
  selectedNodeId,
  onSelectNode,
  defaultExpanded,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const children = childrenMap.get(node.id) ?? [];
  const hasChildren = children.length > 0;
  const labels = edgeLabels.get(node.id) ?? [];
  const isSelected = selectedNodeId === node.id;

  return (
    <div className="tree-node">
      <div
        className={`tree-node-row ${isSelected ? "selected" : ""}`}
        onClick={() => onSelectNode(node.id)}
      >
        {hasChildren ? (
          <button
            className={`expand-toggle${expanded ? " expanded" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            ›
          </button>
        ) : (
          <span className="expand-placeholder" />
        )}
        <StatusIndicator status={node.status} />
        <TypeBadge nodeType={node.node_type} />
        <span className="node-name">{node.name}</span>
        <span className="node-timing">
          {formatOffset(node.start_time, trace.start_time)}{" "}
          [{formatDuration(node.duration_ms)}]
        </span>
        {labels.map((label, i) => (
          <span key={i} className="edge-label">{label}</span>
        ))}
      </div>
      {expanded && hasChildren && (
        <div className="tree-children">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              trace={trace}
              childrenMap={childrenMap}
              edgeLabels={edgeLabels}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              defaultExpanded={child.depth < 2}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TraceTree({ trace, selectedNodeId, onSelectNode }: Props) {
  const childrenMap = useMemo(() => buildChildrenMap(trace), [trace]);
  const edgeLabels = useMemo(() => buildEdgeLabels(trace), [trace]);
  const roots = childrenMap.get(null) ?? [];

  return (
    <div className="trace-tree">
      <div className="trace-tree-body">
        {roots.map((root) => (
          <TreeNode
            key={root.id}
            node={root}
            trace={trace}
            childrenMap={childrenMap}
            edgeLabels={edgeLabels}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            defaultExpanded={true}
          />
        ))}
      </div>
    </div>
  );
}
