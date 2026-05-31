"""LangChain/LangGraph callback handler that records lifecycle events as nodetracer spans.

Usage:
    handler = CallbackHandler()
    with tracer.trace("agent"):
        chain.invoke(input, config={"callbacks": [handler]})

Covers chat-model and tool start/end/error events. Requires the optional
extra: pip install nodetracer[langchain].
"""

from __future__ import annotations

import warnings
from typing import Any
from uuid import UUID

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult

from ..core.context import get_current_trace
from ..core.span import Span
from ..core.tracer_config import TracerConfig
from ..models import Node

_WARN_PREFIX = "nodetracer.langchain adapter"


def _warn(stage: str, error: BaseException) -> None:
    warnings.warn(f"{_WARN_PREFIX}: {stage} failed: {error!r}", stacklevel=3)


def _serialize_message(msg: Any) -> dict[str, Any]:
    """Reduce a LangChain BaseMessage to a JSON-friendly dict.

    Handles both ``str`` and ``list[dict]`` content shapes. Multi-modal
    chunks (image, file, etc.) are summarised as ``[type]`` placeholders
    so a single string still reflects the conversation.
    """
    role = msg.__class__.__name__
    content = getattr(msg, "content", "")
    if isinstance(content, str):
        return {"role": role, "content": content}
    if isinstance(content, list):
        parts: list[str] = []
        for chunk in content:
            if isinstance(chunk, dict):
                ctype = chunk.get("type")
                if ctype == "text":
                    parts.append(chunk.get("text", ""))
                else:
                    parts.append(f"[{ctype or 'attachment'}]")
            else:
                parts.append(str(chunk))
        return {"role": role, "content": " ".join(parts)}
    return {"role": role, "content": str(content)}


class CallbackHandler(BaseCallbackHandler):
    """LangChain callback handler that records lifecycle events as nodetracer spans."""

    def __init__(self, config: TracerConfig | None = None) -> None:
        self._config = config or TracerConfig()
        self._spans: dict[UUID, Span] = {}

    def _parent_node(self, parent_run_id: UUID | None) -> Node | None:
        """Resolve a LangChain ``parent_run_id`` to a span we're tracking.

        Returning ``None`` lets ``Span`` fall back to the current contextvar,
        which is correct for the top-level call inside ``with tracer.trace()``.
        """
        if parent_run_id is None:
            return None
        parent_span = self._spans.get(parent_run_id)
        return parent_span.node_record if parent_span is not None else None

    def on_chat_model_start(
        self,
        serialized: dict[str, Any],
        messages: list[list[Any]],
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        try:
            trace = get_current_trace()
            if trace is None:
                return
            parent_node = self._parent_node(parent_run_id)
            span = Span(
                trace=trace,
                name="llm_call",
                node_type="llm_call",
                parent_node=parent_node,
                config=self._config,
            )
            span.__enter__()
        except Exception as e:
            _warn("on_chat_model_start", e)
            return
        try:
            batches = [[_serialize_message(m) for m in batch] for batch in (messages or [])]
            if len(batches) == 1:
                span.input(messages=batches[0])
            elif batches:
                span.input(batches=batches)
        except Exception as e:
            _warn("on_chat_model_start input capture", e)
        self._spans[run_id] = span

    def on_llm_end(
        self,
        response: LLMResult,
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        span = self._spans.pop(run_id, None)
        if span is None:
            return
        try:
            text = response.generations[0][0].text
            if text:
                span.output(content=text)
        except Exception as e:
            _warn("on_llm_end output capture", e)
        try:
            span.__exit__(None, None, None)
        except Exception as e:
            _warn("on_llm_end span finalize", e)

    def on_llm_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        span = self._spans.pop(run_id, None)
        if span is None:
            return
        try:
            span.__exit__(type(error), error, None)
        except Exception as e:
            _warn("on_llm_error span finalize", e)

    def on_tool_start(
        self,
        serialized: dict[str, Any],
        input_str: str,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        try:
            trace = get_current_trace()
            if trace is None:
                return
            name = serialized.get("name", "tool") if serialized else "tool"
            parent_node = self._parent_node(parent_run_id)
            span = Span(
                trace=trace,
                name=name,
                node_type="tool_call",
                parent_node=parent_node,
                config=self._config,
            )
            span.__enter__()
        except Exception as e:
            _warn("on_tool_start", e)
            return
        try:
            span.input(args=str(input_str))
        except Exception as e:
            _warn("on_tool_start input capture", e)
        self._spans[run_id] = span

    def on_tool_end(
        self,
        output: Any,
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        span = self._spans.pop(run_id, None)
        if span is None:
            return
        try:
            span.output(result=str(output))
        except Exception as e:
            _warn("on_tool_end output capture", e)
        try:
            span.__exit__(None, None, None)
        except Exception as e:
            _warn("on_tool_end span finalize", e)

    def on_tool_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        span = self._spans.pop(run_id, None)
        if span is None:
            return
        try:
            span.__exit__(type(error), error, None)
        except Exception as e:
            _warn("on_tool_error span finalize", e)
