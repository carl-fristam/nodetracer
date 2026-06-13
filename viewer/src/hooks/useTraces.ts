import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTrace, fetchTraces } from "../lib/api";
import type { TraceGraph, TraceSummary } from "../types/trace";

const POLL_INTERVAL = 3000;

export function useTraceList() {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const knownIds = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    try {
      const data = await fetchTraces();
      setTraces(data);
      setError(null);

      const currentIds = new Set(data.map((t) => t.id));
      if (knownIds.current.size > 0) {
        let added = 0;
        for (const id of currentIds) {
          if (!knownIds.current.has(id)) added++;
        }
        if (added > 0) setNewCount((prev) => prev + added);
      }
      knownIds.current = currentIds;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch traces");
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [refresh]);

  const clearNewCount = useCallback(() => setNewCount(0), []);

  return { traces, error, newCount, clearNewCount, refresh };
}

export function useTrace(traceId: string | null) {
  const [trace, setTrace] = useState<TraceGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!traceId) {
      setTrace(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchTrace(traceId)
      .then((data) => {
        if (!cancelled) {
          setTrace(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load trace");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [traceId]);

  return { trace, loading, error };
}

export function useMultiTrace(traceIds: string[]) {
  const [traces, setTraces] = useState<TraceGraph[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idsKey = traceIds.join(",");

  useEffect(() => {
    if (traceIds.length === 0) {
      setTraces([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all(traceIds.map((id) => fetchTrace(id)))
      .then((results) => {
        if (!cancelled) {
          setTraces(results);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load traces");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { traces, loading, error };
}
