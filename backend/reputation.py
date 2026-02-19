"""
reputation.py — Trigger the ReputationAggregator contract.

⚠  STUB: The ReputationAggregator contract has not been deployed yet.
Once Christian shares the ABI and address, fill in the real
implementation.  The public API shape is final; only the internals
will change.
"""

from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv

load_dotenv()

# Placeholder — replace with real ABI once available
REPUTATION_AGGREGATOR_ABI: list[dict[str, Any]] = []


def trigger_reputation_update(
    agent_id: str,
    decision_id: int | None = None,
    snapshot_address: str | None = None,
) -> dict[str, Any]:
    """
    Trigger the on-chain ReputationAggregator for an agent.

    Parameters
    ----------
    agent_id : str
        The agent whose reputation should be recalculated.
    decision_id : int | None
        The specific decision that was just resolved (informational).
    snapshot_address : str | None
        Address of the ContextSnapshot that was resolved.

    Returns
    -------
    dict
        ``{"status": "...", "tx_hash": "0x..." | None}``
    """

    aggregator_address = os.getenv("REPUTATION_AGGREGATOR_ADDRESS", "")

    if not aggregator_address or aggregator_address == "0x0000000000000000000000000000000000000000":
        print(
            f"[reputation] STUB — would trigger reputation update for "
            f"agent={agent_id}, decision_id={decision_id}, "
            f"snapshot={snapshot_address}"
        )
        return {
            "status": "stubbed",
            "tx_hash": None,
            "message": "ReputationAggregator address not configured yet.",
        }

    # ── Real implementation (uncomment when contract is ready) ──────
    #
    # from web3 import Web3
    #
    # rpc_url = os.getenv("RPC_URL", "")
    # private_key = os.getenv("PRIVATE_KEY", "")
    # w3 = Web3(Web3.HTTPProvider(rpc_url))
    #
    # contract = w3.eth.contract(
    #     address=Web3.to_checksum_address(aggregator_address),
    #     abi=REPUTATION_AGGREGATOR_ABI,
    # )
    #
    # account = w3.eth.account.from_key(private_key).address
    # tx = contract.functions.updateReputation(agent_id).build_transaction({
    #     "from": account,
    #     "nonce": w3.eth.get_transaction_count(account),
    #     "gas": 300_000,
    #     "gasPrice": w3.eth.gas_price,
    # })
    # signed = w3.eth.account.sign_transaction(tx, private_key)
    # tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    # receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    # print(f"[reputation] tx confirmed: {receipt['transactionHash'].hex()}")
    #
    # return {
    #     "status": "confirmed",
    #     "tx_hash": receipt["transactionHash"].hex(),
    # }

    return {"status": "not_implemented", "tx_hash": None}
