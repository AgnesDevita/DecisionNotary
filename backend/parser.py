"""
parser.py — Langfuse trace parser.

Extracts agentId, tool calls, faithfulness/answer-relevance scores,
and timestamps from a raw Langfuse trace JSON.

Handles both formats:
  • Wrapped:  {"trace": {...}, "observations": [...]}
  • Flat:     {"id": "...", "scores": [...], "observations": [...], ...}
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any

from models import ParsedTrace, Scores, ToolCall


# ── Helpers ─────────────────────────────────────────────────────────

def _safe_parse_json(value: Any) -> Any:
    """Try to JSON-parse a string; return as-is if it fails."""

    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, ValueError):
            return value
    return value


def _clean_text(value: Any) -> str:
    """Unwrap JSON-encoded strings (e.g. '\"hello\"' → 'hello')."""

    parsed = _safe_parse_json(value)
    return parsed if isinstance(parsed, str) else (str(value) if value is not None else "")


def _extract_agent_id(trace: dict[str, Any]) -> str:
    """Pull agentId from metadata, userId, or trace name."""

    metadata = _safe_parse_json(trace.get("metadata") or {})
    if isinstance(metadata, dict):
        attrs = metadata.get("attributes", {})
        agent_id = metadata.get("agentId") or metadata.get("agent_id") or attrs.get("agent.id", "")
        if agent_id:
            return str(agent_id)
    return str(trace.get("userId") or trace.get("name") or "unknown-agent")


def _extract_tool_calls(observations: list[dict[str, Any]]) -> list[ToolCall]:
    """
    Extract tool calls from observations.

    Handles: direct toolCalls array, OpenAI-style output.tool_calls,
    and named child SPANs.
    """

    tool_calls: list[ToolCall] = []
    for obs in observations:
        obs_type = obs.get("type", "")
        obs_name = obs.get("name", "")

        # Style 1: Direct toolCalls array (real Langfuse format)
        direct_calls: list[Any] = obs.get("toolCalls") or []
        if direct_calls:
            for tc in direct_calls:
                if isinstance(tc, dict):
                    func = tc.get("function", tc)
                    tool_calls.append(ToolCall(
                        name=func.get("name", obs_name), arguments=func.get("arguments", {}),
                        start_time=obs.get("startTime", ""), end_time=obs.get("endTime", ""),
                    ))
            continue

        # Style 2: OpenAI-style nested in generation output
        if obs_type == "GENERATION":
            output = _safe_parse_json(obs.get("output") or {})
            nested = output.get("tool_calls", []) if isinstance(output, dict) else []
            for tc in nested:
                func = tc.get("function", {})
                tool_calls.append(ToolCall(
                    name=func.get("name", obs_name), arguments=func.get("arguments", {}),
                    start_time=obs.get("startTime", ""), end_time=obs.get("endTime", ""),
                ))
    return tool_calls


def _extract_scores(scores: list[dict[str, Any]]) -> Scores:
    """Map scores array to Scores. Handles answer_relevancy / answer_relevance / etc."""

    result = Scores()
    for s in scores:
        name = (s.get("name") or "").lower().replace(" ", "_").replace("-", "_")
        value = s.get("value")
        if value is None:
            continue
        if "faithful" in name:
            result.faithfulness = float(value)
        elif "relevan" in name:
            result.answer_relevance = float(value)
    return result


def _derive_end_time(trace: dict[str, Any], observations: list[dict[str, Any]]) -> str:
    """Derive end time from trace fields or the latest observation."""

    if trace.get("endTime"):
        return str(trace["endTime"])
    latency = trace.get("latency")
    if trace.get("timestamp") and latency is not None:
        try:
            start = datetime.fromisoformat(trace["timestamp"].replace("Z", "+00:00"))
            end = start + timedelta(seconds=float(latency))
            return end.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        except (ValueError, TypeError):
            pass
    end_times = [o.get("endTime", "") for o in observations if o.get("endTime")]
    return max(end_times) if end_times else ""


# ── Public API ──────────────────────────────────────────────────────

def parse_langfuse_trace(raw: dict[str, Any]) -> ParsedTrace:
    """
    Parse a raw Langfuse trace dict into a normalised ParsedTrace.

    Accepts both the wrapped ``{"trace": {...}}`` and flat formats.
    """

    if "trace" in raw and isinstance(raw["trace"], dict):
        trace = raw["trace"]
        observations = raw.get("observations") or trace.get("observations", [])
        scores_raw = trace.get("scores", [])
    else:
        trace = raw
        observations = raw.get("observations", [])
        scores_raw = raw.get("scores", [])

    start_time = trace.get("timestamp") or trace.get("startTime") or ""

    return ParsedTrace(
        trace_id=trace.get("id", ""),
        agent_id=_extract_agent_id(trace),
        input=_clean_text(trace.get("input", "")),
        output=_clean_text(trace.get("output", "")),
        tool_calls=_extract_tool_calls(observations),
        scores=_extract_scores(scores_raw),
        start_time=str(start_time),
        end_time=_derive_end_time(trace, observations),
    )
