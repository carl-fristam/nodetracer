import type { TraceGraph, TraceNode, Edge } from "../types/trace";

export const HEADER_HEIGHT = 28;
export const BAR_HEIGHT = 22;

const ROW_GAP = 4;
const LANE_PADDING_TOP = 6;
const LANE_PADDING_BOTTOM = 6;
const MIN_BAR_WIDTH = 2;

export interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EdgePath {
  d: string;
  edge: Edge;
}

export interface LaneLayout {
  lane: string;
  yStart: number;
  totalHeight: number;
  rows: number;
}

interface TimeScale {
  toX: (offsetMs: number) => number;
  totalMs: number;
  startMs: number;
  labelWidth: number;
  chartWidth: number;
}

export function computeSwimlanes(trace: TraceGraph): string[] {
  const types = new Set<string>();
  for (const node of Object.values(trace.nodes)) {
    types.add(node.node_type);
  }
  return Array.from(types).sort();
}

export function createTimeScale(
  trace: TraceGraph,
  chartWidth: number,
  labelWidth: number,
): TimeScale | null {
  if (!trace.start_time) return null;

  const startMs = new Date(trace.start_time).getTime();
  let endMs = startMs;

  if (trace.end_time) {
    endMs = new Date(trace.end_time).getTime();
  } else {
    for (const node of Object.values(trace.nodes)) {
      if (node.end_time) {
        const t = new Date(node.end_time).getTime();
        if (t > endMs) endMs = t;
      }
    }
  }

  const totalMs = Math.max(endMs - startMs, 1);

  return {
    toX: (offsetMs: number) => labelWidth + (offsetMs / totalMs) * chartWidth,
    totalMs,
    startMs,
    labelWidth,
    chartWidth,
  };
}

export function computeLaneLayouts(
  trace: TraceGraph,
  lanes: string[],
  scale: TimeScale,
): LaneLayout[] {
  const layouts: LaneLayout[] = [];
  let yStart = HEADER_HEIGHT;

  for (const lane of lanes) {
    const nodesInLane = Object.values(trace.nodes).filter(
      (n) => n.node_type === lane && n.start_time != null,
    );
    const rows = computeRowCount(nodesInLane, scale);
    const totalHeight =
      LANE_PADDING_TOP + rows * (BAR_HEIGHT + ROW_GAP) - ROW_GAP + LANE_PADDING_BOTTOM;
    layouts.push({ lane, yStart, totalHeight, rows });
    yStart += totalHeight;
  }

  return layouts;
}

function computeRowCount(nodes: TraceNode[], scale: TimeScale): number {
  const sorted = [...nodes]
    .filter((n) => n.start_time != null)
    .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime());

  const rowEnds: number[] = [];

  for (const node of sorted) {
    const startMs = new Date(node.start_time!).getTime() - scale.startMs;
    const endMs = node.end_time
      ? new Date(node.end_time).getTime() - scale.startMs
      : startMs + 1;

    const x = scale.toX(startMs);
    const xEnd = Math.max(scale.toX(endMs), x + MIN_BAR_WIDTH);

    const row = rowEnds.findIndex((e) => x >= e + 4);
    if (row === -1) {
      rowEnds.push(xEnd);
    } else {
      rowEnds[row] = xEnd;
    }
  }

  return Math.max(1, rowEnds.length);
}

export function computeBarPositions(
  trace: TraceGraph,
  lanes: string[],
  scale: TimeScale,
  laneLayouts: LaneLayout[],
): Map<string, BarRect> {
  const bars = new Map<string, BarRect>();

  for (let li = 0; li < lanes.length; li++) {
    const lane = lanes[li];
    const layout = laneLayouts[li];
    if (!layout) continue;

    const timed = Object.values(trace.nodes)
      .filter((n) => n.node_type === lane && n.start_time != null)
      .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime());

    const rowEnds: number[] = [];

    for (const node of timed) {
      const startMs = new Date(node.start_time!).getTime() - scale.startMs;
      const endMs = node.end_time
        ? new Date(node.end_time).getTime() - scale.startMs
        : startMs + 1;

      const x = scale.toX(startMs);
      const xEnd = Math.max(scale.toX(endMs), x + MIN_BAR_WIDTH);
      const width = xEnd - x;

      let row = rowEnds.findIndex((e) => x >= e + 4);
      if (row === -1) {
        row = rowEnds.length;
        rowEnds.push(xEnd);
      } else {
        rowEnds[row] = xEnd;
      }

      const y = layout.yStart + LANE_PADDING_TOP + row * (BAR_HEIGHT + ROW_GAP);
      bars.set(node.id, { x, y, width, height: BAR_HEIGHT });
    }

    // Untimed nodes get a minimal placeholder at the lane top
    for (const node of Object.values(trace.nodes).filter(
      (n) => n.node_type === lane && n.start_time == null,
    )) {
      bars.set(node.id, {
        x: scale.labelWidth,
        y: layout.yStart + LANE_PADDING_TOP,
        width: MIN_BAR_WIDTH,
        height: BAR_HEIGHT,
      });
    }
  }

  return bars;
}

export function computeDropLines(
  trace: TraceGraph,
  bars: Map<string, BarRect>,
): Array<{ x: number; y1: number; y2: number }> {
  const lines: Array<{ x: number; y1: number; y2: number }> = [];

  for (const node of Object.values(trace.nodes)) {
    if (!node.parent_id) continue;
    const child = bars.get(node.id);
    const parent = bars.get(node.parent_id);
    if (!child || !parent) continue;

    const y1 = parent.y + parent.height / 2;
    const y2 = child.y + child.height / 2;
    if (Math.abs(y2 - y1) > 2) {
      lines.push({ x: child.x, y1, y2 });
    }
  }

  return lines;
}

export function computeEdgePaths(
  trace: TraceGraph,
  bars: Map<string, BarRect>,
): EdgePath[] {
  const paths: EdgePath[] = [];

  for (const edge of trace.edges) {
    if (edge.edge_type === "structural") continue;
    const src = bars.get(edge.source_id);
    const tgt = bars.get(edge.target_id);
    if (!src || !tgt) continue;

    const x1 = src.x + src.width;
    const y1 = src.y + src.height / 2;
    const x2 = tgt.x;
    const y2 = tgt.y + tgt.height / 2;
    const midX = (x1 + x2) / 2;

    paths.push({
      d: `M ${x1} ${y1} C ${midX} ${y1} ${midX} ${y2} ${x2} ${y2}`,
      edge,
    });
  }

  return paths;
}

export function computeTimeAxis(
  scale: TimeScale,
): Array<{ x: number; ms: number; label: string }> {
  const { totalMs, labelWidth, chartWidth } = scale;
  const targetTicks = Math.max(3, Math.floor(chartWidth / 80));
  const interval = niceNumber(totalMs / targetTicks);

  const ticks: Array<{ x: number; ms: number; label: string }> = [];
  for (let ms = 0; ms <= totalMs; ms += interval) {
    const x = scale.toX(ms);
    if (x < labelWidth - 5 || x > labelWidth + chartWidth + 5) continue;
    ticks.push({ x, ms, label: formatTick(ms) });
  }
  return ticks;
}

function niceNumber(n: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / mag;
  if (f < 1.5) return mag;
  if (f < 3.5) return 2 * mag;
  if (f < 7.5) return 5 * mag;
  return 10 * mag;
}

function formatTick(ms: number): string {
  if (ms === 0) return "0";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
}

export function getTotalHeight(laneLayouts: LaneLayout[]): number {
  if (laneLayouts.length === 0) return HEADER_HEIGHT + 40;
  const last = laneLayouts[laneLayouts.length - 1];
  return last.yStart + last.totalHeight;
}
