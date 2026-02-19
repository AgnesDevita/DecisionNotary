# Agent Decision Notary

Notarise AI-agent reasoning **on-chain** (BNB Chain / BSC Testnet) before an agent acts. After the outcome is known, record whether the reasoning held and build a verifiable reputation trail.

## How It Works

```
┌────────────┐     ┌────────────┐     ┌─────────────────────┐
│  Langfuse   │────▶│   Backend   │────▶│  BSC Testnet (97)   │
│  Trace JSON │     │  (FastAPI)  │     │  ContextSnapshot    │
└────────────┘     └────────────┘     └─────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   parser.py        hasher.py        notary.py
   (extract)       (SHA-256)       (web3.py tx)
```

1. **Agent runs** → Langfuse records the trace (input, output, tool calls, eval scores).
2. **`POST /commit`** → Backend parses the trace, computes SHA-256 hashes of the context and decision, then calls `ContextSnapshot.commit(data)` on-chain. Returns a tx hash.
3. **Later, a human labels the outcome** → **`POST /resolve`** records `wasCorrect` on-chain via `resolveOutcome()`.
4. **`POST /trigger-reputation`** → Triggers the ReputationAggregator contract to update the agent's score.

## Smart Contracts

| Contract | Address | Role |
|---|---|---|
| **ContextSnapshotFactory** | [`0xfcb5a3fd52d83cc34a3775be23b8d0b581b29036`](https://testnet.bscscan.com/address/0xfcb5a3fd52d83cc34a3775be23b8d0b581b29036) | Deploys new ContextSnapshot instances |
| **ERC-8004 Identity Registry** | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://testnet.bscscan.com/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) | Gates snapshot creation to registered agents |
| **ReputationAggregator** | _Not deployed yet_ | Will aggregate reputation scores after resolution |

Each `ContextSnapshot` is its own contract with:
- `commit(string data)` → stores a decision record, returns `decisionId`
- `resolveOutcome(string result)` → records the final outcome (once per snapshot)

## Project Structure

```
DecisionNotary/
├── backend/                    # Python backend (this is Jonathan's work)
│   ├── api.py                  # FastAPI endpoints
│   ├── parser.py               # Langfuse trace parser
│   ├── hasher.py               # SHA-256 hashing (context + decision)
│   ├── notary.py               # web3.py on-chain interactions
│   ├── reputation.py           # ReputationAggregator trigger (stub)
│   ├── models.py               # Shared dataclasses + Pydantic models
│   ├── abis.py                 # Contract ABI definitions
│   ├── sample_traces/          # Real Langfuse trace examples
│   ├── requirements.txt        # Python dependencies
│   └── .env                    # Local env config (gitignored)
├── contracts/                  # Solidity contracts (Christian's work)
│   └── src/
│       ├── ContextSnapshot.sol
│       └── ContextSnapshotFactory.sol
└── frontend/                   # React UI (Agnes's work)
```

## Quick Start (Backend)

### Prerequisites

- Python 3.11+
- A BSC Testnet wallet with tBNB (for gas)
- The wallet must be registered as an ERC-8004 agent (ask Christian)

### 1. Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure environment

Create `backend/.env`:

```env
RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
CONTEXT_SNAPSHOT_FACTORY_ADDRESS=0xfcb5a3fd52d83cc34a3775be23b8d0b581b29036
ERC8004_ADDRESS=0x8004A818BFB912233c491871b3d84c89A494BD9e
REPUTATION_AGGREGATOR_ADDRESS=0x0000000000000000000000000000000000000000
```

### 3. Start the server

```bash
uvicorn api:app --reload --port 8000
```

Open **http://localhost:8000/docs** for the interactive Swagger UI.

## API Endpoints

### `GET /health`

Check connection status and wallet registration.

```bash
curl http://localhost:8000/health
```

```json
{
  "status": "ok",
  "wallet": "0x7E31519Fc7280FE3F777Ba08f1b944e8ec45E92a",
  "erc8004_registered": true
}
```

### `POST /create-snapshot`

Deploy a new ContextSnapshot contract. Requires the wallet to be ERC-8004 registered.

```bash
curl -X POST http://localhost:8000/create-snapshot \
  -H "Content-Type: application/json" \
  -d '{"topic": "FMCG-agent-run-1"}'
```

```json
{
  "tx_hash": "0xab9b7508...",
  "snapshot_address": "0xBceEccA9DB5c361eBAa4a333583e9b4C6563D9f0"
}
```

### `POST /commit`

Parse a Langfuse trace, compute hashes, and commit on-chain. Send the full trace JSON as `langfuse_trace`.

```bash
curl -X POST http://localhost:8000/commit \
  -H "Content-Type: application/json" \
  -d '{
    "snapshot_address": "0xBceEccA9DB5c361eBAa4a333583e9b4C6563D9f0",
    "langfuse_trace": { ... }
  }'
```

```json
{
  "tx_hash": "0x0321aa91...",
  "decision_id": 0,
  "context_hash": "28bf2d37...",
  "decision_hash": "2277b6ee...",
  "agent_id": "FMCG-Agent-User"
}
```

The `langfuse_trace` field accepts both formats:
- **Wrapped**: `{"trace": {...}, "observations": [...]}`  (exported from Langfuse UI)
- **Flat**: `{"id": "...", "scores": [...], ...}` (from the Langfuse API)

### `POST /resolve`

Record whether the agent's decision was correct (manual labelling for MVP).

```bash
curl -X POST http://localhost:8000/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "snapshot_address": "0xBceEccA9DB5c361eBAa4a333583e9b4C6563D9f0",
    "was_correct": false,
    "reason": "Low faithfulness score",
    "labeler_id": "jonathan"
  }'
```

```json
{
  "tx_hash": "0x390cd78d...",
  "reputation_status": "stubbed"
}
```

### `POST /trigger-reputation`

Manually trigger the ReputationAggregator (currently stubbed).

```bash
curl -X POST http://localhost:8000/trigger-reputation \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "FMCG-Agent-User"}'
```

## What Gets Stored On-Chain

Each `commit()` writes a deterministic JSON string to the ContextSnapshot contract:

```json
{
  "agent_id": "FMCG-Agent-User",
  "trace_id": "b6d8897eeeb1069e7d0fafe77b8e4f56",
  "context_hash": "28bf2d372284bf7480b85374f8a625a2a9556de1f1d0b796adafc75c0596a4b0",
  "decision_hash": "2277b6eef85cef4a7df7512ae69f49e7875f86b840385a8ffec8ee12cd798374",
  "scores": {
    "faithfulness": 0.0,
    "answer_relevance": 0.12669869716267407
  },
  "timestamps": {
    "start_time": "2026-02-19T11:13:34.734Z",
    "end_time": "2026-02-19T11:13:43.914Z"
  }
}
```

- **context_hash** = SHA-256 of what the agent saw (input + scores + agent identity)
- **decision_hash** = SHA-256 of what the agent decided (output + tool calls)

## Verified On-Chain Transactions

The full pipeline has been tested end-to-end on BSC Testnet:

| Step | Tx Hash | BSCScan |
|---|---|---|
| Create Snapshot | `0xab9b7508...` | [View](https://testnet.bscscan.com/tx/0xab9b75082b95fff279f9e8b159caf4b1d2c04acb33d09f64d322b77a5a6c7f96) |
| Commit | `0x0321aa91...` | [View](https://testnet.bscscan.com/tx/0x0321aa91503a6b74413ad16b107e2f0d356ea1aa334be585f2d56155b0f9d09c) |
| Resolve Outcome | `0x390cd78d...` | [View](https://testnet.bscscan.com/tx/0x390cd78dd02a1a71617082aa05f5eb169337748491354349923e70963b597390) |

## Tech Stack

| Layer | Choice |
|---|---|
| Language | Python 3.11+ |
| HTTP framework | FastAPI |
| Web3 library | web3.py |
| Chain | BSC Testnet (Chain ID 97) |
| Hashing | hashlib SHA-256 |
| Env management | python-dotenv |

## Team

- **Jonathan** — Backend (parser, hasher, notary, API)
- **Christian** — Smart contracts (ContextSnapshot, ERC-8004, ReputationAggregator)
- **Agnes** — Frontend (React UI, leaderboard, demo)
