package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// mkTempLedger creates a fresh ledger in a t.TempDir.
func mkTempLedger(t *testing.T) (*Ledger, string, string) {
	t.Helper()
	dir := t.TempDir()
	logPath := filepath.Join(dir, "ledger.jsonl")
	keyPath := filepath.Join(dir, "ledger.key")
	l, err := OpenLedger(logPath, keyPath)
	if err != nil {
		t.Fatalf("open ledger: %v", err)
	}
	t.Cleanup(func() { _ = l.Close() })
	return l, logPath, keyPath
}

func sampleEntry(agentID, traceID string) TokenEntry {
	return TokenEntry{
		AgentID:       agentID,
		TraceID:       traceID,
		Model:         "claude-opus-4",
		TokensIn:      1024,
		TokensOut:     512,
		CostUSD:       0.0123,
		ContextHash:   "28bf2d372284bf7480b85374f8a625a2a9556de1f1d0b796adafc75c0596a4b0",
		DecisionHash:  "2277b6eef85cef4a7df7512ae69f49e7875f86b840385a8ffec8ee12cd798374",
		TimestampUnix: 1_760_000_000,
	}
}

// TestAppendAndProofRoundTrip — the happy path: write 5 entries, request
// a proof for each, verify it against the signed head.
func TestAppendAndProofRoundTrip(t *testing.T) {
	l, _, _ := mkTempLedger(t)

	for i := 0; i < 5; i++ {
		if _, err := l.Append(sampleEntry("agent-1", "trace-"+string(rune('a'+i)))); err != nil {
			t.Fatalf("append: %v", err)
		}
	}

	for i := 0; i < 5; i++ {
		proof, sth, err := l.Proof(i)
		if err != nil {
			t.Fatalf("proof %d: %v", i, err)
		}
		if !VerifySTH(sth) {
			t.Fatalf("proof %d: STH signature failed to verify", i)
		}
		se, _ := l.Entry(i)
		leafBytes, err := se.Entry.canonicalJSON()
		if err != nil {
			t.Fatalf("canonicalise: %v", err)
		}
		if !VerifyInclusion(leafBytes, proof, fromHex(sth.RootHash)) {
			t.Fatalf("proof %d: inclusion failed", i)
		}
	}
}

// TestReplayRebuildsIdenticalRoot — closing and reopening the ledger yields
// the same Merkle root.
func TestReplayRebuildsIdenticalRoot(t *testing.T) {
	l, logPath, keyPath := mkTempLedger(t)
	for i := 0; i < 3; i++ {
		if _, err := l.Append(sampleEntry("agent-2", "t"+string(rune('a'+i)))); err != nil {
			t.Fatalf("append: %v", err)
		}
	}
	rootBefore := toHex(l.Root())
	_ = l.Close()

	l2, err := OpenLedger(logPath, keyPath)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	defer l2.Close()
	if got := toHex(l2.Root()); got != rootBefore {
		t.Fatalf("root after reopen = %s, want %s", got, rootBefore)
	}
}

// TestReplayDetectsTampering — if an attacker edits a byte in the JSONL
// file, OpenLedger refuses to start.
func TestReplayDetectsTampering(t *testing.T) {
	l, logPath, keyPath := mkTempLedger(t)
	for i := 0; i < 3; i++ {
		if _, err := l.Append(sampleEntry("agent-3", "trace-"+string(rune('a'+i)))); err != nil {
			t.Fatalf("append: %v", err)
		}
	}
	_ = l.Close()

	// Tamper: flip one character inside the second line's agent_id.
	raw, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(string(raw), "\n")
	if len(lines) < 3 {
		t.Fatalf("expected >=3 lines, got %d", len(lines))
	}
	lines[1] = strings.Replace(lines[1], "agent-3", "AGENT-X", 1)
	if err := os.WriteFile(logPath, []byte(strings.Join(lines, "\n")), 0o644); err != nil {
		t.Fatal(err)
	}

	if _, err := OpenLedger(logPath, keyPath); err == nil {
		t.Fatal("expected OpenLedger to refuse a tampered log, got nil error")
	}
}

// TestAppendValidationErrors — missing required fields ⇒ sentinel errors
// that HTTP handlers map to 400.
func TestAppendValidationErrors(t *testing.T) {
	l, _, _ := mkTempLedger(t)
	if _, err := l.Append(TokenEntry{}); err != ErrMissingAgentID {
		t.Fatalf("want ErrMissingAgentID, got %v", err)
	}
	if _, err := l.Append(TokenEntry{AgentID: "a"}); err != ErrMissingHashes {
		t.Fatalf("want ErrMissingHashes, got %v", err)
	}
}

// TestCanonicalJSONIsDeterministic — same logical entry hashes to the same
// leaf hash every time, regardless of insertion order of optional fields.
func TestCanonicalJSONIsDeterministic(t *testing.T) {
	a := sampleEntry("agent", "trace")
	b := sampleEntry("agent", "trace")

	aj, err := a.canonicalJSON()
	if err != nil {
		t.Fatal(err)
	}
	bj, err := b.canonicalJSON()
	if err != nil {
		t.Fatal(err)
	}
	if string(aj) != string(bj) {
		t.Fatalf("canonical JSON differs:\n a = %s\n b = %s", aj, bj)
	}
}
