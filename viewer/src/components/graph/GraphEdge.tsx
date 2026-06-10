import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { getEdgeStyle } from "../../lib/colors";

interface GraphEdgeData {
  edgeType: string;
  label?: string;
  [key: string]: unknown;
}

const STRUCTURAL_STYLE = {
  color: "var(--gray-7)",
  dashArray: "",
  label: "",
};

function GraphEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const { edgeType, label: customLabel } = (data ?? {}) as GraphEdgeData;
  const isStructural = edgeType === "structural" || edgeType === "caused_by";
  const isSequence = edgeType === "sequence";
  const style = isStructural ? STRUCTURAL_STYLE : getEdgeStyle(edgeType);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const displayLabel = customLabel ?? (isStructural ? "" : style.label);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: style.color,
          strokeWidth: selected ? 2.5 : isStructural ? 1 : isSequence ? 1.5 : 1.5,
          strokeDasharray: style.dashArray || undefined,
          opacity: isStructural ? 0.4 : isSequence ? 0.55 : selected ? 1 : 0.7,
        }}
        markerEnd={`url(#marker-${id})`}
      />
      <defs>
        <marker
          id={`marker-${id}`}
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill={style.color} />
        </marker>
      </defs>
      {displayLabel && (
        <EdgeLabelRenderer>
          <div
            className="graph-edge-label"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              color: style.color,
              pointerEvents: "none",
            }}
          >
            {displayLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const GraphEdge = memo(GraphEdgeComponent);
