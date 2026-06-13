import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTraceList, useTrace, useMultiTrace } from "./hooks/useTraces";
import { TraceList } from "./components/TraceList";
import { TraceTree } from "./components/TraceTree";
import { TraceGraph } from "./components/TraceGraph";
import { ViewToggle, type ViewMode } from "./components/ViewToggle";
import { NodeDetail } from "./components/NodeDetail";
import { mergeTraces } from "./lib/merge";
import { Theme } from "@radix-ui/themes";
import "./App.css";

export type AppTheme = "dark" | "light";

export default function App() {
  const { traces, error: listError, newCount, clearNewCount } = useTraceList();
  const [selectedTraceIds, setSelectedTraceIds] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [theme, setTheme] = useState<AppTheme>("dark");

  const selectedArray = useMemo(() => [...selectedTraceIds], [selectedTraceIds]);

  const isMultiSelected = selectedArray.length > 1;

  const { trace: singleTrace, loading: singleLoading, error: singleError } = useTrace(
    isMultiSelected ? null : selectedArray[0] ?? null,
  );

  const {
    traces: multiTraces,
    loading: multiLoading,
    error: multiError,
  } = useMultiTrace(isMultiSelected ? selectedArray : []);

  const { merged, origins } = useMemo<{
    merged: ReturnType<typeof mergeTraces>["merged"] | null;
    origins: TraceOriginMap | null;
  }>(() => {
    if (multiTraces.length === 0) return { merged: null, origins: null };
    if (multiTraces.length === 1)
      return { merged: multiTraces[0], origins: null };
    const result = mergeTraces(multiTraces, "absolute");
    return result;
  }, [multiTraces]);

  const handleSelect = useCallback((id: string) => {
    setSelectedTraceIds(new Set([id]));
    setSelectedNodeId(null);
    clearNewCount();
  }, [clearNewCount]);

  const handleToggle = useCallback((id: string) => {
    setSelectedTraceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSelectedNodeId(null);
  }, []);

  const handleSelectSession = useCallback((traceIds: string[]) => {
    setSelectedTraceIds(new Set(traceIds));
    setSelectedNodeId(null);
    clearNewCount();
  }, [clearNewCount]);

  const activeTrace = isMultiSelected ? merged : singleTrace;
  const loading = isMultiSelected ? multiLoading : singleLoading;
  const traceError = isMultiSelected ? multiError : singleError;

  const selectedNode = activeTrace && selectedNodeId
    ? activeTrace.nodes[selectedNodeId] ?? null
    : null;

  return (
    <Theme
      className="app"
      accentColor="indigo"
      grayColor="slate"
      appearance={theme}
      hasBackground={false}
    >
      <TraceList
        traces={traces}
        selectedIds={selectedTraceIds}
        onSelect={handleSelect}
        onToggle={handleToggle}
        onSelectSession={handleSelectSession}
        newCount={newCount}
        onClearNew={clearNewCount}
        multiSelect={isMultiSelected}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />

      <main className="main-panel">
        <motion.div
          className="floating-top-header"
          animate={{ x: selectedNode ? -404 : 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.35 }}
        >
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </motion.div>

        {listError && <div className="error-banner">{listError}</div>}
        {traceError && <div className="error-banner">{traceError}</div>}

        {selectedTraceIds.size === 0 && (
          <div className="empty-main">
            <div className="empty-main-inner">
              <div className="empty-main-icon">⬡</div>
              <p className="empty-main-title">No trace selected</p>
              <p className="empty-main-sub">Pick one from the sidebar to start inspecting.</p>
            </div>
          </div>
        )}

        {loading && !activeTrace && <div className="loading">Loading trace…</div>}

        {activeTrace && (
          <div 
            className="main-panel-workspace"
            style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column',
              opacity: loading ? 0.6 : 1,
              transition: 'opacity 0.2s ease-in-out',
              pointerEvents: loading ? 'none' : 'auto'
            }}
          >
            {viewMode === "tree" && (
              <TraceTree
                trace={activeTrace}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
              />
            )}

            {viewMode === "graph" && (
              <TraceGraph
                trace={activeTrace}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                onDeselect={() => setSelectedNodeId(null)}
                origins={origins}
                colorMode={theme}
                detailOpen={!!selectedNode}
              />
            )}
          </div>
        )}
      </main>

      <AnimatePresence>
        {selectedNode && activeTrace && (
          <motion.div
            key="node-detail"
            className="node-detail-overlay"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
          >
            <NodeDetail
              node={selectedNode}
              trace={activeTrace}
              onClose={() => setSelectedNodeId(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Theme>
  );
}
