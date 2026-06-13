import { memo, useRef, useEffect, useMemo, useState } from "react";
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
  const nodeRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  const dotOverlay = useMemo(() => {
    if (!dims) return null;
    const { w, h } = dims;
    const r = 8;
    // rw/rh: the rect traces the border CENTER, which is 0.75px inside each outer edge
    const rw = w - 1.5;
    const rh = h - 1.5;
    const perimeter = 2 * (rw - 2 * r) + 2 * (rh - 2 * r) + 2 * Math.PI * r;
    const dotLen = 6;
    const gap = perimeter - dotLen;
    // SVG offset: -0.75 so its origin lands on the border center
    // viewBox matches physical size exactly (1:1, no scaling distortion)
    const svgSize = { w: w + 1.5, h: h + 1.5 };
    return (
      <svg
        style={{
          position: "absolute",
          top: -1.3,
          left: -1.3,
          width: svgSize.w,
          height: svgSize.h,
          pointerEvents: "none",
          zIndex: 10,
          overflow: "visible",
        }}
        viewBox={`0 0 ${svgSize.w} ${svgSize.h}`}
      >
        <defs>
          <filter id="node-dot-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect
          x="0.75" y="0.75"
          width={rw} height={rh}
          rx={r} ry={r}
          fill="none"
          stroke={typeColor}
          strokeWidth="3"
          strokeDasharray={`${dotLen} ${gap}`}
          strokeLinecap="round"
          filter="url(#node-dot-glow)"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to={`-${perimeter}`}
            dur="6s"
            repeatCount="indefinite"
          />
        </rect>
      </svg>
    );
  }, [dims, typeColor]);

  useEffect(() => {
    if (!selected || !nodeRef.current) { setDims(null); return; }
    const { offsetWidth: w, offsetHeight: h } = nodeRef.current;
    setDims({ w, h });
  }, [selected]);

  return (
    <>
      <Handle type="target" position={Position.Top} className="graph-handle" />
      <div
        ref={nodeRef}
        className={`graph-node ${selected ? "selected" : ""} ${isFailed ? "failed" : ""} ${isRoot ? "root" : ""}`}
        style={{
          borderColor: isRoot ? "var(--text-secondary)" : typeColor,
          borderWidth: isRoot ? 1 : 1.5,
          borderStyle: isRoot ? "dashed" : "solid",
          opacity: isRoot ? 0.7 : 1,
          position: "relative",
        }}
      >
        {dotOverlay}
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
