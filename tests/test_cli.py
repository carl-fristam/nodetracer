from __future__ import annotations

import json
from pathlib import Path

import pytest

from nodetracer.cli import main
from nodetracer.models import Edge, Node, TraceGraph
from nodetracer.serializers import save_trace_json


def _create_trace_file(tmp_path: Path) -> Path:
    trace = TraceGraph(name="cli_test")
    root = Node(sequence_number=trace.next_sequence_number(), name="root", node_type="decision")
    child = Node(
        sequence_number=trace.next_sequence_number(),
        name="call",
        node_type="llm_call",
        parent_id=root.id,
        depth=1,
    )
    trace.add_node(root)
    trace.add_node(child)
    trace.add_edge(Edge(source_id=root.id, target_id=child.id))
    return save_trace_json(trace, tmp_path / "trace.json")


def test_cli_inspect_prints_summary_and_tree(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    trace_file = _create_trace_file(tmp_path)
    exit_code = main(["inspect", str(trace_file), "--verbosity", "minimal"])

    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Trace ID:" in captured.out
    assert "Name: cli_test" in captured.out
    assert "Nodes: 2" in captured.out
    assert "Edges: 1" in captured.out
    assert "Trace: cli_test" in captured.out


def test_cli_inspect_json_summary_output(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    trace_file = _create_trace_file(tmp_path)
    exit_code = main(["inspect", str(trace_file), "--json"])

    captured = capsys.readouterr()
    payload = json.loads(captured.out)
    assert exit_code == 0
    assert payload["name"] == "cli_test"
    assert payload["schema_version"] == "0.1.0"
    assert payload["node_count"] == 2
    assert payload["edge_count"] == 1
    assert payload["status_counts"]["pending"] == 2
    assert payload["node_type_counts"]["decision"] == 1
    assert payload["node_type_counts"]["llm_call"] == 1


def test_cli_inspect_json_summary_output_to_file(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    trace_file = _create_trace_file(tmp_path)
    output_path = tmp_path / "summary.json"
    exit_code = main(["inspect", str(trace_file), "--json", "--output", str(output_path)])

    captured = capsys.readouterr()
    payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert exit_code == 0
    assert captured.out == ""
    assert payload["name"] == "cli_test"
    assert payload["node_count"] == 2
    assert payload["edge_count"] == 1


def test_cli_output_without_json_raises_error(tmp_path: Path) -> None:
    trace_file = _create_trace_file(tmp_path)
    with pytest.raises(ValueError, match="--output is only supported when --json is provided"):
        main(["inspect", str(trace_file), "--output", str(tmp_path / "summary.json")])


def test_cli_inspect_summary_skips_tree(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    trace_file = _create_trace_file(tmp_path)
    exit_code = main(["inspect", str(trace_file), "--summary"])

    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Trace ID:" in captured.out
    assert "Nodes: 2" in captured.out
    assert "Trace: cli_test" not in captured.out
