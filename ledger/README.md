# `notary-ledger` — a lightweight token ledger for AI accountability

`notary-ledger` is a **single Go binary plus one append-only file** that gives
every AI agent decision a tamper-evident, cryptographically provable record —
with the same trust guarantees as a blockchain notary, at a fraction of the
operational weight.

It is the second layer of the Agent Decision Notary project. The first layer
(`backend/` + `contracts/`) anchors decisions on BSC Testnet for external
consensus. This layer runs *inside* an organisation's own infrastructure and
handles the high-frequency, low-cost record-keeping that doesn't belong on a
public chain.

## Why this exists

Tokenomics, in the blockchain sense, was the first time people systematically
accounted for compute on a public ledger. Tokenomics, in the GenAI sense, is
the fact that every major model provider now bills per input / output token.

What's been missing until now is a way to **tie those two together**: every
token an AI agent spends produces a decision, and every decision should be
individually auditable — by the organisation that ran it, by its customers,
and (where appropriate) by regulators.

Full blockchain notarisation is the right solution when you need
*adversarial, permissionless* verification. But most enterprise use cases
don't. They need:

| They need                               | They don't need                         |
|-----------------------------------------|-----------------------------------------|
| Proof the record wasn't altered later   | A public validator set                  |
| An external anchor a regulator can cite | Paying gas per record                   |
| Sub-millisecond append latency          | A multi-node consensus protocol         |
| Exportable inclusion proofs             | A mempool, block explorer, or finality  |

`notary-ledger` is designed to sit squarely in the first column — and then
*optionally* anchor its Merkle root on-chain (BSC Testnet, already wired up)
for external consensus on a periodic cadence (e.g. every 10 minutes instead
of every decision).

The design is lifted directly from **Certificate Transparency** (RFC 6962) —
the cryptographic log that secures the Web PKI and has been running in
production for over a decade. We are not inventing new crypto.

## Trust model at a glance

```
┌─────────────────────────────────────────────────────────────────────┐
│                         notary-ledger process                       │
│                                                                     │
│   TokenEntry  ──►  canonical JSON  ──►  SHA-256 leaf hash           │
│                         │                     │                     │
│                         ▼                     ▼                     │
│                   hash-chain link        Merkle tree                │
│                   (prev || leaf)         (RFC 6962)                 │
│                         │                     │                     │
│                         ▼                     ▼                     │
│                   ledger.jsonl           signed tree head           │
│                   (fsync per entry)      (Ed25519, size+root)       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 │  (optional, periodic)
                                 ▼
                    ┌─────────────────────────────┐
                    │  BSC Testnet: publish the   │
                    │  32-byte root as a breadcrumb│
                    └─────────────────────────────┘
```

Three overlapping guarantees:

1. **Hash chain** — every line in `ledger.jsonl` contains the SHA-256 of
   `(previous_entry_hash || this_entry_canonical_JSON)`. Alter any record
   and every subsequent `entry_hash` breaks. Startup replay refuses to open
   a tampered log.

2. **Merkle tree** — every entry can be shown to belong to a tree of a
   given size with an O(log n) proof. A third party can verify membership
   with ~10 lines of Python/Go/JS and a SHA-256 primitive.

3. **Signed tree heads** — the log operator signs `{tree_size, root_hash,
   timestamp}` with an Ed25519 key. Anchoring the STH periodically to BSC
   (or to any external witness) makes it impossible to quietly fork the log.

## Running it

```bash
cd ledger
go build -o notary-ledger .
./notary-ledger --log ledger.jsonl --key ledger.key --addr :8088
```

No dependencies beyond the Go standard library — `go build` works offline.

## HTTP API

### `GET /healthz`

```json
{"status":"ok","size":1247}
```

### `POST /append`

Append a new decision record.

```bash
curl -X POST localhost:8088/append -H 'Content-Type: application/json' -d '{
  "agent_id":      "FMCG-Agent-User",
  "trace_id":      "b6d8897eeeb1069e7d0fafe77b8e4f56",
  "model":         "claude-opus-4",
  "tokens_in":     2048,
  "tokens_out":    512,
  "cost_usd":      0.041,
  "context_hash":  "28bf2d37…",
  "decision_hash": "2277b6ee…",
  "ts":            1760000000
}'
```

Response:

```json
{
  "index": 0,
  "prev_hash": "",
  "entry_hash": "667d465b…",
  "leaf_hash":  "c5c88db5…",
  "entry": { … }
}
```

### `GET /head`

Current signed tree head.

```json
{
  "tree_size":  1247,
  "root_hash":  "07b88b45…",
  "timestamp":  1776335233,
  "public_key": "aba415f1…",
  "signature":  "ef603a5e…"
}
```

### `GET /entry?i=0`

Read a specific entry.

### `GET /proof?i=0`

Inclusion proof + fresh STH:

```json
{
  "index": 0,
  "leaf_hash": "c5c88db5…",
  "entry": { … },
  "proof": [
    {"hash": "d14b3609…", "left": false}
  ],
  "signed_head": { "tree_size": 2, "root_hash": "07b88b45…", … }
}
```

### `POST /verify`

Server-side verification of `(entry, proof, root)`. Useful for sanity-checks;
the whole point is that any client can verify offline.

## Verifying a proof from Python (no dependencies)

```python
import hashlib, json, urllib.request

r = json.loads(urllib.request.urlopen("http://localhost:8088/proof?i=0").read())

# 1. Rebuild the leaf hash from the entry (must match RFC 6962 domain separation).
leaf_bytes = json.dumps(r["entry"], sort_keys=True, separators=(",", ":")).encode()
running = hashlib.sha256(b"\x00" + leaf_bytes).digest()

# 2. Walk the audit path to the root.
for step in r["proof"]:
    sib = bytes.fromhex(step["hash"])
    running = hashlib.sha256(
        b"\x01" + (sib + running if step["left"] else running + sib)
    ).digest()

# 3. Compare.
assert running.hex() == r["signed_head"]["root_hash"], "proof did not verify"
print("OK — decision", r["index"], "is authenticated under root", running.hex())
```

## How this plugs into the existing backend

The Python backend (`backend/hasher.py`) already produces `context_hash` and
`decision_hash` from Langfuse traces. The canonical JSON schema for
`TokenEntry` was designed to mirror that pipeline, so the Python `/commit`
handler can write to both BSC *and* the ledger in the same call:

```python
# backend/api.py handle_commit — proposed extension
import urllib.request, json

def post_to_ledger(trace, commit_bytes):
    body = json.dumps({
        "agent_id":      trace.agent_id,
        "trace_id":      trace.trace_id,
        "model":         trace.model,
        "tokens_in":     trace.usage.input_tokens,
        "tokens_out":    trace.usage.output_tokens,
        "cost_usd":      trace.usage.cost_usd,
        "context_hash":  build_context_hash(trace),
        "decision_hash": build_decision_hash(trace),
        "ts":            int(trace.end_time_unix),
    }).encode()
    req = urllib.request.Request(
        "http://ledger:8088/append",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    return json.loads(urllib.request.urlopen(req).read())
```

Both sides store the same `(context_hash, decision_hash)` pair — so anyone
holding a Langfuse trace can independently recompute those hashes and check
them against *either* the on-chain record *or* the ledger's inclusion proof.

## Operational footprint

| Component       | Footprint                                      |
|-----------------|------------------------------------------------|
| Binary          | ~9 MB static Go binary, zero deps              |
| State on disk   | `ledger.jsonl` (one line per decision) + `ledger.key` (32-byte seed) |
| RAM             | O(n) leaf hashes — ~32 bytes per record        |
| CPU per append  | 2× SHA-256 + one fsync                         |
| CPU per proof   | O(log n) SHA-256                               |
| External infra  | None (optionally: BSC RPC for STH anchoring)   |

Compare with running a private Hyperledger Fabric network: channel setup,
orderer nodes, CA, peers, chaincode lifecycle, gossip tuning — all of which
`notary-ledger` sidesteps without giving up cryptographic proof of
tamper-evidence.

## What this does *not* do (by design)

- **Access control.** Deploy behind a reverse proxy (mTLS, Cloudflare
  Access, IAP). The ledger's job is integrity, not authn/authz.
- **Retention / deletion.** The log is append-only. If a record must be
  redacted under e.g. GDPR right-to-erasure, the canonical pattern is to
  publish a redaction entry that supersedes the original; don't edit the
  file.
- **Adversarial decentralisation.** One operator runs one process. If the
  operator is coerced into equivocating (signing two different STHs at the
  same tree size), the usual CT-style defences apply: gossip with peer
  witnesses and/or anchor the STH on-chain every few minutes.

## Tests

```bash
cd ledger
go test -v ./...
```

Covers: empty / singleton / multi-leaf Merkle roots, proof round-trips
across tree sizes 1–8, tampered-leaf detection, tampered-proof-step
detection, full append / proof / verify cycle with a signed head,
replay-after-restart idempotency, and refusal to replay a tampered log.

## Roadmap (short)

- **STH anchoring to BSC** — publish each STH's 32-byte root to the
  existing `ContextSnapshot` contract as a breadcrumb. One cheap transaction
  every N decisions instead of one per decision.
- **Consistency proofs** — prove that a newer STH extends an older STH
  (so a verifier who cached STH@size=100 can confirm STH@size=200 is a
  superset, not a fork). RFC 6962 §2.1.2.
- **SQLite index** — optional secondary index for per-agent dashboards;
  the JSONL log stays the source of truth.

---

This component is the direction Jonathan sketched on 16 Apr: *same
cryptographic trust guarantees as a full blockchain notary, a fraction of
the operational weight, one Go binary and a database instead of a
multi-node consensus network.*
