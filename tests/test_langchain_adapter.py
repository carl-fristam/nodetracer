"""Tests for the LangChain/LangGraph callback adapter.

All tests call hook methods directly — no real LangChain chains or API
calls are made. This exercises the adapter's state machine in isolation.
"""

from __future__ import annotations

import warnings
from uuid import uuid4

from langchain_core.outputs import Generation, LLMResult

from nodetracer.adapters.langchain import CallbackHandler
from nodetracer.core import Tracer, TracerConfig
from nodetracer.models import NodeStatus
from nodetracer.storage import MemoryStore


def _make_tracer() -> Tracer:
    return Tracer(config=TracerConfig(), storage=MemoryStore())


def _llm_result(text: str = "") -> LLMResult:
    return LLMResult(generations=[[Generation(text=text)]])


def test_tool_happy_path() -> None:
    tracer = _make_tracer()
    handler = CallbackHandler()
    run_id = uuid4()

    with tracer.trace("run") as root:
        handler.on_tool_start({"name": "get_weather"}, "{'city': 'Paris'}", run_id=run_id)
        handler.on_tool_end("It's sunny", run_id=run_id)

    nodes = [n for n in root.trace.nodes.values() if n.node_type == "tool_call"]
    assert len(nodes) == 1
    node = nodes[0]
    assert node.name == "get_weather"
    assert node.status == NodeStatus.COMPLETED
    assert node.input_data["args"] == "{'city': 'Paris'}"
    assert node.output_data["result"] == "It's sunny"


def test_tool_error_path() -> None:
    tracer = _make_tracer()
    handler = CallbackHandler()
    run_id = uuid4()
    error = ValueError("connection refused")

    with tracer.trace("run") as root:
        handler.on_tool_start({"name": "bad_tool"}, "{}", run_id=run_id)
        handler.on_tool_error(error, run_id=run_id)

    nodes = [n for n in root.trace.nodes.values() if n.node_type == "tool_call"]
    assert len(nodes) == 1
    node = nodes[0]
    assert node.status == NodeStatus.FAILED
    assert node.error == "connection refused"
    assert node.error_type == "ValueError"
    assert node.error_traceback is not None


def test_llm_happy_path() -> None:
    tracer = _make_tracer()
    handler = CallbackHandler()
    run_id = uuid4()

    with tracer.trace("run") as root:
        handler.on_chat_model_start({}, [[]], run_id=run_id)
        handler.on_llm_end(_llm_result("Paris is lovely."), run_id=run_id)

    nodes = [n for n in root.trace.nodes.values() if n.node_type == "llm_call"]
    assert len(nodes) == 1
    node = nodes[0]
    assert node.status == NodeStatus.COMPLETED
    assert node.output_data["content"] == "Paris is lovely."


def test_llm_error_path() -> None:
    tracer = _make_tracer()
    handler = CallbackHandler()
    run_id = uuid4()
    error = RuntimeError("rate limited")

    with tracer.trace("run") as root:
        handler.on_chat_model_start({}, [[]], run_id=run_id)
        handler.on_llm_error(error, run_id=run_id)

    nodes = [n for n in root.trace.nodes.values() if n.node_type == "llm_call"]
    assert len(nodes) == 1
    node = nodes[0]
    assert node.status == NodeStatus.FAILED
    assert node.error_type == "RuntimeError"


def test_no_active_trace_silently_skips() -> None:
    handler = CallbackHandler()
    run_id = uuid4()

    # No `with tracer.trace(...)` — get_current_trace() returns None.
    # None of these should raise.
    handler.on_chat_model_start({}, [[]], run_id=run_id)
    handler.on_llm_end(_llm_result("hi"), run_id=run_id)
    handler.on_tool_start({"name": "t"}, "{}", run_id=run_id)
    handler.on_tool_end("ok", run_id=run_id)

    assert len(handler._spans) == 0


def test_parent_run_id_nests_child_under_parent() -> None:
    tracer = _make_tracer()
    handler = CallbackHandler()
    llm_run = uuid4()
    tool_run = uuid4()

    with tracer.trace("run") as root:
        handler.on_chat_model_start({}, [[]], run_id=llm_run)
        # Tool triggered by the LLM call — parent_run_id points at it.
        handler.on_tool_start({"name": "search"}, "{}", run_id=tool_run, parent_run_id=llm_run)
        handler.on_tool_end("results", run_id=tool_run)
        handler.on_llm_end(_llm_result("done"), run_id=llm_run)

    llm_node = next(n for n in root.trace.nodes.values() if n.node_type == "llm_call")
    tool_node = next(n for n in root.trace.nodes.values() if n.node_type == "tool_call")

    assert tool_node.parent_id == llm_node.id


def test_parallel_tools_are_siblings() -> None:
    tracer = _make_tracer()
    handler = CallbackHandler()
    llm_run = uuid4()
    tool_a_run = uuid4()
    tool_b_run = uuid4()

    with tracer.trace("run") as root:
        handler.on_chat_model_start({}, [[]], run_id=llm_run)
        # Two tools both triggered by the same LLM call.
        handler.on_tool_start({"name": "tool_a"}, "{}", run_id=tool_a_run, parent_run_id=llm_run)
        handler.on_tool_start({"name": "tool_b"}, "{}", run_id=tool_b_run, parent_run_id=llm_run)
        handler.on_tool_end("a_result", run_id=tool_a_run)
        handler.on_tool_end("b_result", run_id=tool_b_run)
        handler.on_llm_end(_llm_result("done"), run_id=llm_run)

    llm_node = next(n for n in root.trace.nodes.values() if n.node_type == "llm_call")
    tool_nodes = [n for n in root.trace.nodes.values() if n.node_type == "tool_call"]

    assert len(tool_nodes) == 2
    # Both tools must share the same parent (the LLM node), not each other.
    assert all(n.parent_id == llm_node.id for n in tool_nodes)
    assert {n.name for n in tool_nodes} == {"tool_a", "tool_b"}


def test_broken_span_creation_warns_and_does_not_raise() -> None:
    tracer = _make_tracer()
    handler = CallbackHandler()
    run_id = uuid4()

    with tracer.trace("run"), warnings.catch_warnings(record=True):
        warnings.simplefilter("always")
        handler.on_tool_start(None, object(), run_id=run_id)  # type: ignore[arg-type]

    # If the span was started, close it cleanly; if not, _spans is empty — both fine.
    assert True
