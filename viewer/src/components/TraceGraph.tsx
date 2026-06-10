import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
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
  origins?: TraceOriginMap | null;
  colorMode?: "dark" | "light";
}

const nodeTypes = { graphNode: GraphNode };
const edgeTypes = { graphEdge: GraphEdge };

function TraceGraphInner({ trace, selectedNodeId, onSelectNode, colorMode = "dark" }: Props) {
  const { fitView } = useReactFlow();

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
    setTimeout(() => fitView({ padding: 0.15, duration: 200 }), 50);
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

  if (Object.keys(trace.nodes).length === 0) {
    return (
      <div className="trace-graph-empty">
        No nodes in this trace.
      </div>
    );
  }

  return (
    <div className="trace-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={4}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        colorMode={colorMode}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color={colorMode === "dark" ? "#1e293b" : "#cbd5e1"}
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
      <TraceGraphInner {...props} />
    </ReactFlowProvider>
  );
}
