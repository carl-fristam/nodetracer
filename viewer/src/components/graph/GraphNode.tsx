import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { getNodeTypeColor, STATUS_COLORS } from "../../lib/colors";
import { formatDuration } from "../../lib/format";
import type { NodeStatus } from "../../types/trace";

interface GraphNodeData {
  label: string;
  nodeType: string;
  status: NodeStatus;
  durationMs: number | null;
  error: string | null;
  isRoot?: boolean;
  [key: string]: unknown;
}

const STATUS_ICONS: Record<NodeStatus, string> = {
  completed: "✓",
  failed: "✗",
  running: "◉",
  pending: "○",
  cancelled: "⊘",
};

function GraphNodeComponent({ data, selected }: NodeProps) {
  const { label, nodeType, status, durationMs, error, isRoot } = data as unknown as GraphNodeData;
  const typeColor = getNodeTypeColor(nodeType);
  const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.pending;
  const isFailed = status === "failed";

  return (
    <>
      <Handle type="target" position={Position.Top} className="graph-handle" />
      <div
        className={`graph-node ${selected ? "selected" : ""} ${isFailed ? "failed" : ""} ${isRoot ? "root" : ""}`}
        style={{
          borderColor: selected ? "var(--accent)" : isRoot ? "var(--text-secondary)" : typeColor,
          borderWidth: selected ? 2 : isRoot ? 1 : 1.5,
          borderStyle: isRoot ? "dashed" : "solid",
          opacity: isRoot ? 0.7 : 1,
        }}
      >
        <div className="graph-node-header">
          <span className="graph-node-status" style={{ color: statusColor }}>
            {STATUS_ICONS[status]}
          </span>
          <span className="graph-node-label">{label}</span>
        </div>
        <div className="graph-node-meta">
          <span className="graph-node-type" style={{ color: typeColor }}>
            {nodeType}
          </span>
          {durationMs != null && (
            <span className="graph-node-duration">{formatDuration(durationMs)}</span>
          )}
        </div>
        {error && (
          <div className="graph-node-error" title={error}>
            {error.length > 40 ? error.slice(0, 40) + "…" : error}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="graph-handle" />
    </>
  );
}

export const GraphNode = memo(GraphNodeComponent);
