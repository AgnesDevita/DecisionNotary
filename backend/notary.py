"""
notary.py — On-chain interaction layer.

Connects to BSC Testnet via web3.py and exposes helpers to:
  • create_snapshot()  — deploy a new ContextSnapshot via the factory
  • commit()           — write a decision record to a ContextSnapshot
  • resolve_outcome()  — finalise the outcome on the same contract
  • check_agent_registered() — verify ERC-8004 registration
"""

from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from web3 import Web3
from web3.contract import Contract
from web3.types import TxReceipt

from abis import CONTEXT_SNAPSHOT_ABI, CONTEXT_SNAPSHOT_FACTORY_ABI, ERC8004_ABI

load_dotenv()


# ── Web3 bootstrap ──────────────────────────────────────────────────

def _get_web3() -> Web3:
    """Return a connected Web3 instance for BSC Testnet."""

    rpc_url = os.getenv("RPC_URL", "https://data-seed-prebsc-1-s1.binance.org:8545/")
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        raise ConnectionError(f"Cannot connect to RPC at {rpc_url}")
    return w3


def _get_account(w3: Web3) -> str:
    """Derive the account address from the private key in env."""

    private_key = os.getenv("PRIVATE_KEY", "")
    if not private_key:
        raise ValueError("PRIVATE_KEY env var is not set")
    return w3.eth.account.from_key(private_key).address


def _send_tx(w3: Web3, tx_fn: Any) -> TxReceipt:
    """
    Build, sign, send, and wait for a transaction.

    Gas is estimated dynamically with a 20 % safety buffer.
    """

    private_key = os.getenv("PRIVATE_KEY", "")
    account = w3.eth.account.from_key(private_key).address

    estimated_gas = tx_fn.estimate_gas({"from": account})
    gas_limit = int(estimated_gas * 1.2)

    tx = tx_fn.build_transaction({
        "from": account,
        "nonce": w3.eth.get_transaction_count(account, "pending"),
        "gas": gas_limit,
        "gasPrice": w3.eth.gas_price,
    })

    signed = w3.eth.account.sign_transaction(tx, private_key)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    print(f"[notary] tx confirmed: {receipt['transactionHash'].hex()}")
    return receipt


def _snapshot_contract(w3: Web3, address: str) -> Contract:
    """Instantiate a ContextSnapshot contract object."""

    return w3.eth.contract(
        address=Web3.to_checksum_address(address),
        abi=CONTEXT_SNAPSHOT_ABI,
    )


# ── Public API ──────────────────────────────────────────────────────

def create_snapshot(topic: str) -> dict[str, Any]:
    """Deploy a new ContextSnapshot via the factory (requires ERC-8004)."""

    w3 = _get_web3()
    factory_address = os.getenv("CONTEXT_SNAPSHOT_FACTORY_ADDRESS", "")
    if not factory_address:
        raise ValueError("CONTEXT_SNAPSHOT_FACTORY_ADDRESS env var is not set")

    factory = w3.eth.contract(
        address=Web3.to_checksum_address(factory_address),
        abi=CONTEXT_SNAPSHOT_FACTORY_ABI,
    )
    receipt = _send_tx(w3, factory.functions.createSnapshot(topic))

    events = factory.events.SnapshotCreated().process_receipt(receipt)
    snapshot_addr = events[0]["args"]["snapshot"] if events else None
    print(f"[notary] snapshot created at: {snapshot_addr}")

    return {"tx_hash": receipt["transactionHash"].hex(), "snapshot_address": snapshot_addr}


def commit(snapshot_address: str, data: str) -> dict[str, Any]:
    """Call ``ContextSnapshot.commit(data)`` and return tx hash + decisionId."""

    w3 = _get_web3()
    contract = _snapshot_contract(w3, snapshot_address)
    receipt = _send_tx(w3, contract.functions.commit(data))

    events = contract.events.Committed().process_receipt(receipt)
    decision_id = events[0]["args"]["decisionId"] if events else None

    return {"tx_hash": receipt["transactionHash"].hex(), "decision_id": decision_id}


def resolve_outcome(snapshot_address: str, result: str) -> dict[str, Any]:
    """Call ``ContextSnapshot.resolveOutcome(result)`` on-chain."""

    w3 = _get_web3()
    contract = _snapshot_contract(w3, snapshot_address)
    receipt = _send_tx(w3, contract.functions.resolveOutcome(result))

    return {"tx_hash": receipt["transactionHash"].hex()}


def get_commits(snapshot_address: str) -> list[dict[str, Any]]:
    """Read all commits from a ContextSnapshot (view call, no gas)."""

    w3 = _get_web3()
    contract = _snapshot_contract(w3, snapshot_address)
    raw = contract.functions.getCommits().call()
    return [{"author": c[0], "data": c[1], "timestamp": c[2]} for c in raw]


def is_resolved(snapshot_address: str) -> bool:
    """Check whether a ContextSnapshot has already been resolved."""

    w3 = _get_web3()
    contract = _snapshot_contract(w3, snapshot_address)
    return contract.functions.resolved().call()


def check_agent_registered() -> dict[str, Any]:
    """Check if the configured wallet is registered as an ERC-8004 agent."""

    w3 = _get_web3()
    account = _get_account(w3)

    erc8004_address = os.getenv("ERC8004_ADDRESS", "")
    if not erc8004_address:
        raise ValueError("ERC8004_ADDRESS env var is not set")

    erc8004 = w3.eth.contract(
        address=Web3.to_checksum_address(erc8004_address), abi=ERC8004_ABI,
    )
    balance = erc8004.functions.balanceOf(account).call()

    return {"address": account, "registered": balance > 0, "erc8004_balance": balance}
