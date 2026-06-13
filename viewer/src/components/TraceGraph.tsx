import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useViewport,
  ReactFlowProvider,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { TraceGraph as TraceGraphType } from "../types/trace";
import type { TraceOriginMap } from "../lib/merge";
import { layoutGraph } from "../lib/graph-layout";
import { GraphNode } from "./graph/GraphNode";
import { GraphEdge } from "./graph/GraphEdge";
import { getNodeTypeColor } from "../lib/colors";

interface Props {
  trace: TraceGraphType;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onDeselect?: () => void;
  origins?: TraceOriginMap | null;
  colorMode?: "dark" | "light";
  detailOpen?: boolean;
}

const nodeTypes = { graphNode: GraphNode };
const edgeTypes = { graphEdge: GraphEdge };

function _TraceGraphInner({ trace, selectedNodeId, onSelectNode, onDeselect, colorMode = "dark", detailOpen = false }: Props) {
  const { fitView } = useReactFlow();
  const { x, y, zoom } = useViewport();
  const [isMoving, setIsMoving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { initialNodes, initialEdges } = useMemo(() => {
    const result = layoutGraph(trace);
    return { initialNodes: result.nodes, initialEdges: result.edges };
  }, [trace]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    const result = layoutGraph(trace);
    setNodes(result.nodes);
    setEdges(result.edges);
    setTimeout(() => fitView({ padding: 0.2, duration: 200 }), 50);
  }, [trace, setNodes, setEdges, fitView]);

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: n.id === selectedNodeId,
      })),
    );
  }, [selectedNodeId, setNodes]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onSelectNode(node.id);
    },
    [onSelectNode],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${(e.clientX - rect.left).toFixed(1)}px`);
    el.style.setProperty("--mouse-y", `${(e.clientY - rect.top).toFixed(1)}px`);
    el.style.setProperty("--mouse-active", "1");
    if (mouseIdleTimer.current) clearTimeout(mouseIdleTimer.current);
    mouseIdleTimer.current = setTimeout(() => {
      el.style.setProperty("--mouse-active", "0");
    }, 1500);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (mouseIdleTimer.current) clearTimeout(mouseIdleTimer.current);
    containerRef.current?.style.setProperty("--mouse-active", "0");
  }, []);

  const handleMoveStart = useCallback(() => setIsMoving(true), []);
  const handleMoveEnd = useCallback(() => setIsMoving(false), []);

  if (Object.keys(trace.nodes).length === 0) {
    return (
      <div className="trace-graph-empty">
        No nodes in this trace.
      </div>
    );
  }

  return (
    <div
      className={`trace-graph${detailOpen ? " detail-open" : ""}`}
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={
        {
          "--viewport-x": `${x.toFixed(2)}px`,
          "--viewport-y": `${y.toFixed(2)}px`,
          "--viewport-zoom": zoom.toFixed(3),
          "--is-moving": isMoving ? 1 : 0,
        } as React.CSSProperties
      }
    >
      <div className="mouse-glow" />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={onDeselect}
        onMoveStart={handleMoveStart}
        onMoveEnd={handleMoveEnd}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, includeHiddenNodes: false }}
        minZoom={0.1}
        maxZoom={4}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        panOnScroll={true}
        panOnDrag={false}
        colorMode={colorMode}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.2}
          color={colorMode === "dark" ? "#475569" : "#5e6e85"}
        />
        <Controls
          showInteractive={false}
          className="graph-controls"
        />
        <MiniMap
          nodeColor={(node: Node) => {
            const nodeType = (node.data as Record<string, unknown>)?.nodeType as string | undefined;
            return nodeType ? getNodeTypeColor(nodeType) : "var(--gray-9)";
          }}
          className="graph-minimap"
        />
      </ReactFlow>
    </div>
  );
}

export function TraceGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <_TraceGraphInner {...props} />
    </ReactFlowProvider>
  );
}
