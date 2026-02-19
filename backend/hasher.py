"""
hasher.py — Deterministic SHA-256 hashing for context snapshots and decisions.

Produces two hashes:
  1. context_hash  — what the agent saw (input, scores, agent identity).
  2. decision_hash — what the agent decided (output, tool calls).

Both are hex-encoded SHA-256 digests.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from models import ParsedTrace


# ── Helpers ─────────────────────────────────────────────────────────

def _deterministic_json(obj: Any) -> str:
    """
    Serialise *obj* to a JSON string with sorted keys and no extra whitespace.

    This ensures the same logical object always produces the same byte
    sequence, which is required for reproducible hashing.
    """

    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _sha256_hex(data: str) -> str:
    """Return the hex-encoded SHA-256 digest of a UTF-8 string."""

    return hashlib.sha256(data.encode("utf-8")).hexdigest()


# ── Public API ──────────────────────────────────────────────────────

def build_context_hash(trace: ParsedTrace) -> str:
    """
    Hash the *context* the agent had when it made its decision.

    Includes: agent_id, input, faithfulness score, answer-relevance
    score, and the start timestamp.

    Returns
    -------
    str
        Hex-encoded SHA-256 digest (64 chars).
    """

    context_obj = {
        "agent_id": trace.agent_id,
        "input": trace.input,
        "scores": {
            "faithfulness": trace.scores.faithfulness,
            "answer_relevance": trace.scores.answer_relevance,
        },
        "start_time": trace.start_time,
    }
    return _sha256_hex(_deterministic_json(context_obj))


def build_decision_hash(trace: ParsedTrace) -> str:
    """
    Hash the *decision* the agent produced.

    Includes: output text and the list of tool calls
    (name + arguments for each).

    Returns
    -------
    str
        Hex-encoded SHA-256 digest (64 chars).
    """

    tool_calls_for_hash = [
        {"name": tc.name, "arguments": tc.arguments}
        for tc in trace.tool_calls
    ]

    decision_obj = {
        "output": trace.output,
        "tool_calls": tool_calls_for_hash,
    }
    return _sha256_hex(_deterministic_json(decision_obj))


def build_commit_data(trace: ParsedTrace) -> str:
    """
    Build the single JSON string that will be stored on-chain via
    ``ContextSnapshot.commit(string data)``.

    The string contains the agent id, both hashes, scores, and
    timestamps — everything needed to verify the decision later.

    Returns
    -------
    str
        Deterministic JSON string ready to send on-chain.
    """

    context_hash = build_context_hash(trace)
    decision_hash = build_decision_hash(trace)

    commit_payload = {
        "agent_id": trace.agent_id,
        "trace_id": trace.trace_id,
        "context_hash": context_hash,
        "decision_hash": decision_hash,
        "scores": {
            "faithfulness": trace.scores.faithfulness,
            "answer_relevance": trace.scores.answer_relevance,
        },
        "timestamps": {
            "start_time": trace.start_time,
            "end_time": trace.end_time,
        },
    }

    return _deterministic_json(commit_payload)
