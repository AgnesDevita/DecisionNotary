// ledger.go — The Ledger: orchestrates hash-chain + Merkle tree + store.
//
// Durability contract (in order):
//   1. Canonicalise the entry → bytes that will be hashed.
//   2. Compute the hash-chain link and the Merkle leaf hash.
//   3. Append to the JSONL file and fsync.
//   4. Only then update in-memory state.
//
// If step 3 fails, in-memory state is untouched and the caller sees the
// error. If the process dies mid-write, the next start replays the log
// and the truncated line is rejected by the scanner — we never silently
// accept a partial record.

package main

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"sync"
)

// Sentinel errors so HTTP handlers can distinguish caller mistakes (400)
// from storage failures (500).
var (
	ErrMissingAgentID = errors.New("agent_id is required")
	ErrMissingHashes  = errors.New("context_hash and decision_hash are required")
)

// Ledger is a tamper-evident, append-only log of TokenEntry records.
type Ledger struct {
	mu       sync.Mutex
	store    *Store
	tree     *MerkleTree
	entries  []StoredEntry
	prevHash []byte // the entry_hash of the last appended entry (zero for empty log)
	signer   *Signer
}

// OpenLedger opens (or creates) a ledger backed by a JSONL file and
// an Ed25519 signing key, replaying the log on startup.
func OpenLedger(logPath, keyPath string) (*Ledger, error) {
	signer, err := LoadOrCreateSigner(keyPath)
	if err != nil {
		return nil, fmt.Errorf("signer: %w", err)
	}

	existing, err := ReadAll(logPath)
	if err != nil {
		return nil, fmt.Errorf("replay log: %w", err)
	}

	store, err := OpenStore(logPath)
	if err != nil {
		return nil, fmt.Errorf("open store: %w", err)
	}

	l := &Ledger{
		store:   store,
		tree:    &MerkleTree{},
		signer:  signer,
		entries: make([]StoredEntry, 0, len(existing)),
	}
	// Replay — recompute leaf hashes and validate the chain as we go so
	// startup is also a full audit of the on-disk state.
	var prev []byte
	for i, se := range existing {
		if se.Index != uint64(i) {
			return nil, fmt.Errorf("replay: entry %d has index=%d", i, se.Index)
		}
		if se.PrevHash != toHex(prev) {
			return nil, fmt.Errorf("replay: entry %d prev_hash mismatch", i)
		}
		leafBytes, err := se.Entry.canonicalJSON()
		if err != nil {
			return nil, fmt.Errorf("replay: canonicalise entry %d: %w", i, err)
		}
		lh := leafHash(leafBytes)
		if se.LeafHash != toHex(lh) {
			return nil, fmt.Errorf("replay: entry %d leaf_hash mismatch (tampered?)", i)
		}
		chained := chainHash(prev, leafBytes)
		if se.EntryHash != toHex(chained) {
			return nil, fmt.Errorf("replay: entry %d entry_hash mismatch (tampered?)", i)
		}
		l.tree.AppendLeafHash(lh)
		l.entries = append(l.entries, se)
		prev = chained
	}
	l.prevHash = prev
	return l, nil
}

// Close flushes and closes the underlying store.
func (l *Ledger) Close() error { return l.store.Close() }

// Append adds a new TokenEntry and returns the resulting StoredEntry.
func (l *Ledger) Append(e TokenEntry) (StoredEntry, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if e.AgentID == "" {
		return StoredEntry{}, ErrMissingAgentID
	}
	if e.ContextHash == "" || e.DecisionHash == "" {
		return StoredEntry{}, ErrMissingHashes
	}

	leafBytes, err := e.canonicalJSON()
	if err != nil {
		return StoredEntry{}, fmt.Errorf("canonicalise entry: %w", err)
	}
	lh := leafHash(leafBytes)
	chained := chainHash(l.prevHash, leafBytes)

	se := StoredEntry{
		Index:     uint64(len(l.entries)),
		PrevHash:  toHex(l.prevHash),
		EntryHash: toHex(chained),
		LeafHash:  toHex(lh),
		Entry:     e,
	}

	// Persist first, mutate state second. If the write fails, caller
	// retries on a consistent ledger.
	if err := l.store.Append(se); err != nil {
		return StoredEntry{}, err
	}
	l.tree.AppendLeafHash(lh)
	l.entries = append(l.entries, se)
	l.prevHash = chained
	return se, nil
}

// Size returns the number of entries in the ledger.
func (l *Ledger) Size() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.entries)
}

// Entry returns the stored entry at index i.
func (l *Ledger) Entry(i int) (StoredEntry, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if i < 0 || i >= len(l.entries) {
		return StoredEntry{}, false
	}
	return l.entries[i], true
}

// Root returns the current Merkle root.
func (l *Ledger) Root() []byte {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.tree.Root()
}

// Head returns a freshly signed STH for the current tree state.
func (l *Ledger) Head() (SignedTreeHead, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.signer.Sign(uint64(l.tree.Size()), l.tree.Root())
}

// Proof returns an inclusion proof for entry i alongside a fresh STH.
func (l *Ledger) Proof(i int) ([]ProofStep, SignedTreeHead, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	proof, err := l.tree.InclusionProof(i)
	if err != nil {
		return nil, SignedTreeHead{}, err
	}
	sth, err := l.signer.Sign(uint64(l.tree.Size()), l.tree.Root())
	if err != nil {
		return nil, SignedTreeHead{}, err
	}
	return proof, sth, nil
}

// chainHash produces the next hash-chain link: SHA-256(prev || leafBytes).
//
// This is independent of the Merkle tree and provides a simple linear
// integrity check: breaking it anywhere invalidates every subsequent
// entry_hash, so a tampered store is spotted the moment replay reaches
// the altered record.
func chainHash(prev, leafBytes []byte) []byte {
	h := sha256.New()
	h.Write(prev)
	h.Write(leafBytes)
	return h.Sum(nil)
}
