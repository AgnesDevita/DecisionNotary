"""
api.py — FastAPI HTTP endpoints for the Agent Decision Notary backend.

Endpoints
---------
POST /create-snapshot     — create a new ContextSnapshot via the factory
POST /commit              — parse trace, hash, commit on-chain
POST /resolve             — resolve outcome (manual wasCorrect for MVP)
POST /trigger-reputation  — manually trigger the reputation aggregator
GET  /health              — liveness check + agent registration status
"""

from __future__ import annotations

import json
import traceback
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from hasher import build_commit_data, build_context_hash, build_decision_hash
from models import (
    CommitRequest, CommitResponse,
    CreateSnapshotRequest, CreateSnapshotResponse,
    ReputationRequest, ReputationResponse,
    ResolveRequest, ResolveResponse,
)
from notary import check_agent_registered, commit, create_snapshot, is_resolved, resolve_outcome
from parser import parse_langfuse_trace
from reputation import trigger_reputation_update

# ── App setup ───────────────────────────────────────────────────────

app = FastAPI(
    title="Agent Decision Notary",
    description="Notarise AI-agent reasoning on BNB Chain (BSC Testnet).",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Endpoints ───────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict[str, Any]:
    """Liveness probe + agent registration check."""

    try:
        reg = check_agent_registered()
        return {"status": "ok", "wallet": reg["address"], "erc8004_registered": reg["registered"]}
    except Exception as exc:
        return {"status": "degraded", "error": str(exc)}


@app.post("/create-snapshot", response_model=CreateSnapshotResponse)
def handle_create_snapshot(req: CreateSnapshotRequest) -> CreateSnapshotResponse:
    """Deploy a new ContextSnapshot contract via the factory."""

    try:
        result = create_snapshot(topic=req.topic)
        return CreateSnapshotResponse(tx_hash=result["tx_hash"], snapshot_address=result["snapshot_address"])
    except ConnectionError as exc:
        raise HTTPException(status_code=503, detail=f"Web3 connection error: {exc}")
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Create snapshot failed: {exc}")


@app.post("/commit", response_model=CommitResponse)
def handle_commit(req: CommitRequest) -> CommitResponse:
    """Parse a Langfuse trace, compute hashes, and commit on-chain."""

    try:
        parsed = parse_langfuse_trace(req.langfuse_trace)
        context_hash = build_context_hash(parsed)
        decision_hash = build_decision_hash(parsed)
        commit_data = build_commit_data(parsed)

        result = commit(snapshot_address=req.snapshot_address, data=commit_data)

        return CommitResponse(
            tx_hash=result["tx_hash"],
            decision_id=result["decision_id"],
            context_hash=context_hash,
            decision_hash=decision_hash,
            agent_id=parsed.agent_id,
        )
    except ConnectionError as exc:
        raise HTTPException(status_code=503, detail=f"Web3 connection error: {exc}")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Commit failed: {exc}")


@app.post("/resolve", response_model=ResolveResponse)
def handle_resolve(req: ResolveRequest) -> ResolveResponse:
    """Record the outcome of a previously committed decision."""

    try:
        if is_resolved(req.snapshot_address):
            raise HTTPException(status_code=409, detail="This ContextSnapshot has already been resolved.")

        result_payload = json.dumps(
            {"was_correct": req.was_correct, "reason": req.reason, "labeler_id": req.labeler_id},
            sort_keys=True,
        )
        tx_result = resolve_outcome(snapshot_address=req.snapshot_address, result=result_payload)

        rep = trigger_reputation_update(agent_id="", snapshot_address=req.snapshot_address)

        return ResolveResponse(tx_hash=tx_result["tx_hash"], reputation_status=rep["status"])
    except HTTPException:
        raise
    except ConnectionError as exc:
        raise HTTPException(status_code=503, detail=f"Web3 connection error: {exc}")
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Resolve failed: {exc}")


@app.post("/trigger-reputation", response_model=ReputationResponse)
def handle_trigger_reputation(req: ReputationRequest) -> ReputationResponse:
    """Manually trigger a reputation update for an agent."""

    try:
        result = trigger_reputation_update(
            agent_id=req.agent_id, decision_id=req.decision_id, snapshot_address=req.snapshot_address,
        )
        return ReputationResponse(status=result["status"], tx_hash=result.get("tx_hash"), message=result.get("message", ""))
    except ConnectionError as exc:
        raise HTTPException(status_code=503, detail=f"Web3 connection error: {exc}")
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Reputation trigger failed: {exc}")
