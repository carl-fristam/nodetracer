"""Inspect subcommand implementation."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from typing import Literal, cast

from ..exceptions import NodetracerLoadError
from ..models import NodeStatus, TraceGraph
from ..renderers import render_trace
from ..serializers import load_trace_json

VerbosityArg = Literal["minimal", "standard", "full"]


def run_inspect(
    trace_file: Path,
    verbosity: VerbosityArg,
    *,
    as_json: bool,
    output_path: Path | None,
    summary_only: bool = False,
) -> int:
    if output_path is not None and not as_json:
        raise ValueError("--output is only supported when --json is provided")

    try:
        trace = load_trace_json(trace_file)
    except FileNotFoundError:
        print(f"Error: file not found: {trace_file}", file=sys.stderr)
        return 1
    except NodetracerLoadError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except OSError as exc:
        print(f"Error reading file: {exc}", file=sys.stderr)
        return 1
    summary = _build_summary(trace)

    if as_json:
        payload = json.dumps(summary, ensure_ascii=True, sort_keys=True)
        if output_path is not None:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(payload + "\n", encoding="utf-8")
        else:
            print(payload)
        return 0

    _print_text_summary(summary)

    if not summary_only:
        print()
        print(render_trace(trace, verbosity=verbosity, color=sys.stdout.isatty()))
    return 0


def _print_text_summary(summary: dict[str, object]) -> None:
    """Render the summary dict as the human-readable header.

    Shares its source of truth with the --json payload so the two
    representations cannot drift apart.
    """
    duration_ms = summary["duration_ms"]
    duration = f"{duration_ms:.0f}ms" if isinstance(duration_ms, float) else "unknown"

    print(f"Trace ID: {summary['trace_id']}")
    print(f"Name: {summary['name'] or '<unnamed>'}")
    print(f"Schema: {summary['schema_version']}")
    print(f"Duration: {duration}")
    print(f"Nodes: {summary['node_count']}")
    print(f"Edges: {summary['edge_count']}")

    status_counts = cast(dict[str, int], summary["status_counts"])
    print("Status counts:")
    for status_name in sorted(status_counts):
        count = status_counts[status_name]
        # _build_summary returns all statuses (incl. zeros) for stable JSON shape;
        # human-readable output skips zeros to match prior behavior.
        if count == 0:
            continue
        print(f"  - {status_name}: {count}")

    type_counts = cast(dict[str, int], summary["node_type_counts"])
    print("Node type counts:")
    for node_type, count in type_counts.items():
        print(f"  - {node_type}: {count}")


def _build_summary(trace: TraceGraph) -> dict[str, object]:
    status_counts = Counter(node.status for node in trace.nodes.values())
    node_type_counts = Counter(node.node_type for node in trace.nodes.values())
    full_status_counts = {status.value: int(status_counts.get(status, 0)) for status in NodeStatus}
    sorted_type_counts = dict(sorted(node_type_counts.items(), key=lambda item: item[0]))

    return {
        "trace_id": trace.trace_id,
        "name": trace.name,
        "schema_version": trace.schema_version,
        "duration_ms": trace.duration_ms,
        "node_count": len(trace.nodes),
        "edge_count": len(trace.edges),
        "status_counts": full_status_counts,
        "node_type_counts": sorted_type_counts,
    }
