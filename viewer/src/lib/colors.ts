import type { NodeStatus } from "../types/trace";

const NODE_TYPE_COLORS: Record<string, string> = {
  llm_call:   "#6366f1",
  tool_call:  "#f59e0b",
  tool_result:"#10b981",
  retrieval:  "#06b6d4",
  decision:   "#8b5cf6",
  agent:      "#ec4899",
  embedding:  "#14b8a6",
  sub_agent:  "#f97316",
  planning:   "#a855f7",
  memory:     "#3b82f6",
};

const DEFAULT_NODE_COLOR = "#64748b";

export function getNodeTypeColor(nodeType: string): string {
  return NODE_TYPE_COLORS[nodeType] ?? DEFAULT_NODE_COLOR;
}

export const STATUS_COLORS: Record<NodeStatus, string> = {
  pending:   "#64748b",
  running:   "#3b82f6",
  completed: "#10b981",
  failed:    "#ef4444",
  cancelled: "#f59e0b",
};

export const STATUS_ICONS: Record<NodeStatus, string> = {
  completed: "✓",
  failed:    "✗",
  running:   "◉",
  pending:   "○",
  cancelled: "⊘",
};

const TRACE_ACCENT_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ec4899",
  "#06b6d4", "#8b5cf6", "#f97316", "#14b8a6",
];

export function getTraceAccentColor(index: number): string {
  return TRACE_ACCENT_COLORS[index % TRACE_ACCENT_COLORS.length];
}

interface EdgeStyle {
  color: string;
  dashArray: string;
  label: string;
}

const EDGE_STYLES: Record<string, EdgeStyle> = {
  sequence:    { color: "var(--gray-6)",  dashArray: "",    label: "" },
  caused_by:   { color: "var(--gray-7)",  dashArray: "",    label: "" },
  causal:      { color: "#6366f1", dashArray: "",    label: "causes" },
  causation:   { color: "#6366f1", dashArray: "",    label: "causes" },
  data_flow:   { color: "#06b6d4", dashArray: "4 2", label: "data" },
  data:        { color: "#06b6d4", dashArray: "4 2", label: "data" },
  retry:       { color: "#f59e0b", dashArray: "6 3", label: "retry" },
  fallback:    { color: "#f97316", dashArray: "6 3", label: "fallback" },
  branch:      { color: "#8b5cf6", dashArray: "4 2", label: "branch" },
  delegation:  { color: "#ec4899", dashArray: "",    label: "delegates" },
};

const DEFAULT_EDGE_STYLE: EdgeStyle = { color: "var(--gray-8)", dashArray: "3 3", label: "" };

export function getEdgeStyle(edgeType: string): EdgeStyle {
  return EDGE_STYLES[edgeType] ?? DEFAULT_EDGE_STYLE;
}
