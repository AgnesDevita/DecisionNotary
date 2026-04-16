// store.go — Append-only JSONL store for ledger entries.
//
// One line per entry. Each line is self-describing (index, prev_hash,
// entry_hash, leaf_hash, entry payload). The file is the authoritative
// record; the Merkle tree and chain state are reconstructed from it on
// startup.
//
// Why JSONL instead of SQLite? Jonathan's design principle for this
// component is *radical operational simplicity*. A JSONL file is:
//
//   - grep-able, diff-able, tail-able — an operator can spot-check
//     accountability records without a query engine;
//   - trivially replicated (rsync, S3 sync, object storage append);
//   - verifiable end-to-end with twenty lines of Python or curl.
//
// When per-agent query throughput becomes a bottleneck we can bolt on
// a SQLite index that mirrors this log — but the log stays the source
// of truth.

package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
)

// StoredEntry is what actually lives on disk: the TokenEntry plus the
// cryptographic metadata that makes the ledger tamper-evident.
type StoredEntry struct {
	Index     uint64     `json:"index"`
	PrevHash  string     `json:"prev_hash"`  // hex — hash-chain link to previous entry
	EntryHash string     `json:"entry_hash"` // hex — SHA-256(prev_hash || canonical_entry)
	LeafHash  string     `json:"leaf_hash"`  // hex — RFC 6962 leaf hash of canonical_entry
	Entry     TokenEntry `json:"entry"`
}

// Store is an append-only JSONL log.
type Store struct {
	path string
	f    *os.File
}

// OpenStore opens (or creates) the JSONL log file for append.
func OpenStore(path string) (*Store, error) {
	f, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE|os.O_APPEND, 0o644)
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	return &Store{path: path, f: f}, nil
}

// Close closes the underlying file.
func (s *Store) Close() error {
	if s == nil || s.f == nil {
		return nil
	}
	return s.f.Close()
}

// Append writes one StoredEntry as a single JSON line and fsyncs.
//
// We fsync on every append because losing an accountability record
// silently is the exact failure mode this system exists to prevent.
func (s *Store) Append(e StoredEntry) error {
	line, err := json.Marshal(e)
	if err != nil {
		return fmt.Errorf("marshal entry: %w", err)
	}
	line = append(line, '\n')
	if _, err := s.f.Write(line); err != nil {
		return fmt.Errorf("write entry: %w", err)
	}
	if err := s.f.Sync(); err != nil {
		return fmt.Errorf("fsync entry: %w", err)
	}
	return nil
}

// ReadAll replays the log file from the start.
//
// Used on startup to reconstruct in-memory state (chain head + Merkle tree).
func ReadAll(path string) ([]StoredEntry, error) {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	defer f.Close()

	var out []StoredEntry
	// Use a generous buffer — token-usage payloads can be larger than the
	// default 64 KiB scanner limit once we include prompt hashes and trace
	// identifiers.
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 1<<16), 1<<24)

	for scanner.Scan() {
		var se StoredEntry
		if err := json.Unmarshal(scanner.Bytes(), &se); err != nil {
			return nil, fmt.Errorf("malformed line at index %d: %w", len(out), err)
		}
		out = append(out, se)
	}
	if err := scanner.Err(); err != nil && err != io.EOF {
		return nil, fmt.Errorf("scan %s: %w", path, err)
	}
	return out, nil
}
