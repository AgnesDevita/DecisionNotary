"""
models.py — Shared data classes and Pydantic request / response models.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel, Field


# ── Trace data classes (used by parser.py and hasher.py) ────────────

@dataclass
class ToolCall:
    """A single tool invocation recorded inside the trace."""

    name: str
    arguments: dict[str, Any]
    result: Any | None = None
    start_time: str = ""
    end_time: str = ""


@dataclass
class Scores:
    """Evaluation scores attached to the trace."""

    faithfulness: float | None = None
    answer_relevance: float | None = None


@dataclass
class ParsedTrace:
    """Normalised representation of a Langfuse trace for notarisation."""

    trace_id: str
    agent_id: str
    input: str
    output: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    scores: Scores = field(default_factory=Scores)
    start_time: str = ""
    end_time: str = ""


# ── API Requests ────────────────────────────────────────────────────

class CreateSnapshotRequest(BaseModel):
    """Payload for POST /create-snapshot."""

    topic: str = Field(..., description="Human-readable topic for the snapshot")


class CommitRequest(BaseModel):
    """Payload for POST /commit."""

    snapshot_address: str = Field(
        ..., description="Address of the ContextSnapshot contract instance"
    )
    langfuse_trace: dict[str, Any] = Field(
        ..., description="Raw Langfuse trace JSON object"
    )


class ResolveRequest(BaseModel):
    """Payload for POST /resolve."""

    snapshot_address: str = Field(
        ..., description="Address of the ContextSnapshot contract instance"
    )
    was_correct: bool = Field(
        ..., description="Whether the agent's decision was correct"
    )
    reason: str = Field("", description="Optional human-readable reason")
    labeler_id: str = Field("", description="Who labelled this outcome")


class ReputationRequest(BaseModel):
    """Payload for POST /trigger-reputation."""

    agent_id: str
    decision_id: int | None = None
    snapshot_address: str | None = None


# ── Responses ───────────────────────────────────────────────────────

class CreateSnapshotResponse(BaseModel):
    """Response from POST /create-snapshot."""

    tx_hash: str
    snapshot_address: str | None


class CommitResponse(BaseModel):
    """Response from POST /commit."""

    tx_hash: str
    decision_id: int | None
    context_hash: str
    decision_hash: str
    agent_id: str


class ResolveResponse(BaseModel):
    """Response from POST /resolve."""

    tx_hash: str
    reputation_status: str


class ReputationResponse(BaseModel):
    """Response from POST /trigger-reputation."""

    status: str
    tx_hash: str | None
    message: str = ""
