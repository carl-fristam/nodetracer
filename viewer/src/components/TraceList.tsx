import { useMemo, useState } from "react";
import { Sun, Moon, GitGraph, Search } from "lucide-react";
import type { TraceSummary } from "../types/trace";
import type { AppTheme } from "../App";
import { formatDuration, formatDate } from "../lib/format";
import { getTraceAccentColor } from "../lib/colors";
const UNGROUPED_KEY = "__ungrouped__";

interface Props {
  traces: TraceSummary[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onSelectSession?: (traceIds: string[]) => void;
  newCount: number;
  onClearNew: () => void;
  multiSelect: boolean;
  theme: AppTheme;
  onToggleTheme: () => void;
}

interface SessionGroup {
  key: string;
  label: string;
  traces: TraceSummary[];
}

export function TraceList({
  traces,
  selectedIds,
  onSelect,
  onToggle,
  onSelectSession,
  newCount,
  onClearNew,
  multiSelect,
  theme,
  onToggleTheme,
}: Props) {
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(new Set());
  const selectedArray = [...selectedIds];

  const groups = useMemo((): SessionGroup[] => {
    const bySession = new Map<string, TraceSummary[]>();
    for (const t of traces) {
      const key = t.session_id ?? UNGROUPED_KEY;
      if (!bySession.has(key)) bySession.set(key, []);
      bySession.get(key)!.push(t);
    }
    const result: SessionGroup[] = [];
    for (const [key, groupTraces] of bySession.entries()) {
      const label =
        key === UNGROUPED_KEY ? "Ungrouped" : `Session: ${key.slice(0, 8)}…`;
      result.push({ key, label, traces: groupTraces });
    }
    return result;
  }, [traces]);

  const handleClick = (id: string, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      onToggle(id);
    } else {
      onSelect(id);
    }
  };

  const handleSessionHeaderClick = (group: SessionGroup) => {
    if (onSelectSession && group.traces.length > 0) {
      onSelectSession(group.traces.map((t) => t.id));
    }
  };

  const toggleCollapsed = (key: string) => {
    setCollapsedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <aside className="trace-list dark">
      <div className="sidebar-brand">
        <div className="brand-logo">
          <GitGraph size={20} className="brand-icon" />
          <span className="brand-name">NODETRACER</span>
        </div>
        <button className="theme-toggle" onClick={onToggleTheme} title="Toggle theme">
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>

      <div className="sidebar-search">
        <div className="search-container">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            placeholder="Search traces..."
            className="search-input"
          />
        </div>
      </div>

      <div className="trace-list-header">
        <h2>Traces</h2>
        {newCount > 0 && (
          <button className="new-badge" onClick={onClearNew}>
            {newCount} new
          </button>
        )}
      </div>
      {multiSelect && selectedIds.size > 1 && (
        <div className="multi-select-hint">
          {selectedIds.size} traces selected
        </div>
      )}
      {traces.length === 0 ? (
        <div className="empty-state">No traces found. Waiting for new traces…</div>
      ) : (
        <ul className="trace-list-groups">
          {groups.map((group) => {
            const isCollapsed = collapsedSessions.has(group.key);
            const isSession = group.key !== UNGROUPED_KEY;

            return (
              <li key={group.key} className="trace-list-group">
                {isSession && (
                  <div
                    className="trace-list-session-header"
                    onClick={() => toggleCollapsed(group.key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) =>
                      (e.key === "Enter" || e.key === " ") && toggleCollapsed(group.key)
                    }
                  >
                    <span className="trace-list-session-chevron">
                      {isCollapsed ? "▶" : "▼"}
                    </span>
                    <span className="trace-list-session-label">{group.label}</span>
                    <span className="trace-list-session-count">{group.traces.length}</span>
                    {onSelectSession && group.traces.length > 1 && (
                      <button
                        type="button"
                        className="trace-list-session-select-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSessionHeaderClick(group);
                        }}
                        title="Select all in session"
                      >
                        Select all
                      </button>
                    )}
                  </div>
                )}
                {!isCollapsed && (
                  <ul className="trace-list-items">
                {group.traces.map((t) => {
                    const isSelected = selectedIds.has(t.id);
                    const accentIndex = selectedArray.indexOf(t.id);
                    const accentColor =
                      accentIndex >= 0 ? getTraceAccentColor(accentIndex) : undefined;

                    return (
                      <li
                        key={t.id}
                        className={`trace-item ${isSelected ? "selected" : ""}`}
                        onClick={(e) => handleClick(t.id, e)}
                      >
                        {multiSelect && (
                          <span
                            className="trace-check"
                            style={
                              isSelected && accentColor ? { background: accentColor } : undefined
                            }
                          >
                            {isSelected ? "✓" : ""}
                          </span>
                        )}
                        <div className="trace-item-content">
                          <div className="trace-item-name">{t.name || t.id}</div>
                          <div className="trace-item-meta">
                            <span>{formatDuration(t.duration_ms)}</span>
                            <span className="separator">·</span>
                            <span>{t.node_count} nodes</span>
                            <span className="separator">·</span>
                            <span>{formatDate(t.start_time)}</span>
                          </div>
                          {t.error && <div className="trace-item-error">{t.error}</div>}
                        </div>
                      </li>
                    );
                  })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
