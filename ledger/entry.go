// entry.go — TokenEntry: the accountability record for a single AI decision.
//
// Each entry captures *who* ran the agent, *what* it cost in tokens, *what*
// it saw (context hash), *what* it decided (decision hash), and optionally
// *how well* it performed (evaluation scores). The ledger stores these in
// an append-only, hash-chained, Merkle-committed form so they cannot be
// retroactively altered without detection.

package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
)

// TokenEntry is a single accountability record for an AI agent decision.
//
// The fields intentionally mirror the on-chain commit payload produced by
// backend/hasher.py — so the same trace can be notarised *both* on BSC and
// in the lightweight ledger and the two records cross-verify.
type TokenEntry struct {
	// Identity
	AgentID string `json:"agent_id"`
	TraceID string `json:"trace_id"`
	Model   string `json:"model,omitempty"`

	// Token accounting (the "tokenomics" angle — cost attribution per
	// decision, auditable by any third party).
	TokensIn  uint64  `json:"tokens_in"`
	TokensOut uint64  `json:"tokens_out"`
	CostUSD   float64 `json:"cost_usd,omitempty"`

	// Cryptographic commitments (opaque to the ledger — the hashes are
	// computed upstream by backend/hasher.py).
	ContextHash  string `json:"context_hash"`
	DecisionHash string `json:"decision_hash"`

	// Evaluation scores (optional)
	Faithfulness    *float64 `json:"faithfulness,omitempty"`
	AnswerRelevance *float64 `json:"answer_relevance,omitempty"`

	// Outcome (populated later when a human labels the decision)
	WasCorrect    *bool  `json:"was_correct,omitempty"`
	OutcomeReason string `json:"outcome_reason,omitempty"`

	// Unix epoch seconds; the ledger timestamps at append time.
	TimestampUnix int64 `json:"ts"`
}

// canonicalJSON returns a deterministic JSON encoding of the entry.
//
// We round-trip through a map[string]any so Go's encoding/json sorts the
// keys — this matches Python's ``json.dumps(..., sort_keys=True)`` used on
// the backend, so the same logical entry produces the same byte sequence
// (and therefore the same hash) regardless of which side builds it.
func (e *TokenEntry) canonicalJSON() ([]byte, error) {
	raw, err := json.Marshal(e)
	if err != nil {
		return nil, err
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, err
	}
	return json.Marshal(m) // Go sorts keys for map[string]any
}

// entryContentHash is the SHA-256 of the entry's canonical JSON.
//
// This is *not* the Merkle leaf hash (which uses the RFC 6962 0x00 prefix);
// it is used for the hash-chain linking each entry to the previous one.
func (e *TokenEntry) entryContentHash() ([]byte, error) {
	b, err := e.canonicalJSON()
	if err != nil {
		return nil, err
	}
	h := sha256.Sum256(b)
	return h[:], nil
}

func toHex(b []byte) string   { return hex.EncodeToString(b) }
func fromHex(s string) []byte { b, _ := hex.DecodeString(s); return b }
