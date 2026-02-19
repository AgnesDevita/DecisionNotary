"""
abis.py — Minimal ABI definitions for on-chain contracts.

Derived from contracts/src/ContextSnapshot.sol and
contracts/src/ContextSnapshotFactory.sol.
"""

from __future__ import annotations

from typing import Any

# ── ContextSnapshot ─────────────────────────────────────────────────

CONTEXT_SNAPSHOT_ABI: list[dict[str, Any]] = [
    {
        "inputs": [{"internalType": "string", "name": "data", "type": "string"}],
        "name": "commit",
        "outputs": [{"internalType": "uint256", "name": "decisionId", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "string", "name": "result", "type": "string"}],
        "name": "resolveOutcome",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getCommits",
        "outputs": [
            {
                "components": [
                    {"internalType": "address", "name": "author", "type": "address"},
                    {"internalType": "string", "name": "data", "type": "string"},
                    {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
                ],
                "internalType": "struct ContextSnapshot.Commit[]",
                "name": "",
                "type": "tuple[]",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getOutcome",
        "outputs": [
            {
                "components": [
                    {"internalType": "string", "name": "result", "type": "string"},
                    {"internalType": "uint256", "name": "resolvedAt", "type": "uint256"},
                ],
                "internalType": "struct ContextSnapshot.Outcome",
                "name": "",
                "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "resolved",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "author", "type": "address"},
            {"indexed": True, "name": "decisionId", "type": "uint256"},
            {"indexed": False, "name": "data", "type": "string"},
            {"indexed": False, "name": "timestamp", "type": "uint256"},
        ],
        "name": "Committed",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [{"indexed": False, "name": "result", "type": "string"}],
        "name": "OutcomeResolved",
        "type": "event",
    },
]

# ── ContextSnapshotFactory ──────────────────────────────────────────

CONTEXT_SNAPSHOT_FACTORY_ABI: list[dict[str, Any]] = [
    {
        "inputs": [{"internalType": "string", "name": "topic", "type": "string"}],
        "name": "createSnapshot",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getSnapshots",
        "outputs": [{"internalType": "address[]", "name": "", "type": "address[]"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "snapshot", "type": "address"},
            {"indexed": False, "name": "topic", "type": "string"},
            {"indexed": True, "name": "creator", "type": "address"},
        ],
        "name": "SnapshotCreated",
        "type": "event",
    },
]

# ── ERC-8004 Identity Registry ──────────────────────────────────────

ERC8004_ABI: list[dict[str, Any]] = [
    {
        "inputs": [{"name": "owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]
