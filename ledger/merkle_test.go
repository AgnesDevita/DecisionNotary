package main

import (
	"bytes"
	"crypto/sha256"
	"testing"
)

// TestEmptyRootMatchesRFC6962 — an empty CT-style tree hashes to SHA-256("").
func TestEmptyRootMatchesRFC6962(t *testing.T) {
	var m MerkleTree
	want := sha256.Sum256(nil)
	if !bytes.Equal(m.Root(), want[:]) {
		t.Fatalf("empty root = %x, want %x", m.Root(), want[:])
	}
}

// TestSingletonRootIsLeafHash — single-leaf tree root equals the leaf hash.
func TestSingletonRootIsLeafHash(t *testing.T) {
	var m MerkleTree
	m.AppendLeaf([]byte("only-entry"))
	if !bytes.Equal(m.Root(), leafHash([]byte("only-entry"))) {
		t.Fatalf("singleton root mismatch")
	}
}

// TestInclusionProofsRoundTrip — every leaf in a tree of size 1..8 verifies.
//
// We use small sizes to also exercise the asymmetric split cases (e.g. n=3
// splits into left-2 + right-1), where the Merkle tree isn't balanced.
func TestInclusionProofsRoundTrip(t *testing.T) {
	for size := 1; size <= 8; size++ {
		var m MerkleTree
		leaves := make([][]byte, size)
		for i := 0; i < size; i++ {
			leaves[i] = []byte{byte('A' + i)}
			m.AppendLeaf(leaves[i])
		}
		root := m.Root()
		for i := 0; i < size; i++ {
			proof, err := m.InclusionProof(i)
			if err != nil {
				t.Fatalf("size=%d i=%d: proof err: %v", size, i, err)
			}
			if !VerifyInclusion(leaves[i], proof, root) {
				t.Fatalf("size=%d i=%d: proof failed to verify", size, i)
			}
		}
	}
}

// TestTamperedLeafFailsVerification — flipping a byte in the leaf breaks the proof.
func TestTamperedLeafFailsVerification(t *testing.T) {
	var m MerkleTree
	for i := 0; i < 5; i++ {
		m.AppendLeaf([]byte{byte('A' + i)})
	}
	proof, err := m.InclusionProof(2)
	if err != nil {
		t.Fatal(err)
	}
	tampered := []byte("X") // was 'C'
	if VerifyInclusion(tampered, proof, m.Root()) {
		t.Fatal("expected verification to fail for tampered leaf")
	}
}

// TestTamperedProofStepFailsVerification — flipping a bit inside any proof
// step hash breaks verification.
func TestTamperedProofStepFailsVerification(t *testing.T) {
	var m MerkleTree
	for i := 0; i < 7; i++ {
		m.AppendLeaf([]byte{byte('A' + i)})
	}
	leaf := []byte{byte('A' + 3)}
	proof, err := m.InclusionProof(3)
	if err != nil {
		t.Fatal(err)
	}
	if len(proof) == 0 {
		t.Fatal("expected non-empty proof for tree size 7")
	}
	// Flip the last byte of the first step's hash.
	h := fromHex(proof[0].Hash)
	h[len(h)-1] ^= 0x01
	proof[0].Hash = toHex(h)

	if VerifyInclusion(leaf, proof, m.Root()) {
		t.Fatal("expected verification to fail for tampered proof step")
	}
}

// TestOutOfRangeProof — asking for a proof beyond the tree's size errors cleanly.
func TestOutOfRangeProof(t *testing.T) {
	var m MerkleTree
	m.AppendLeaf([]byte("one"))
	if _, err := m.InclusionProof(1); err == nil {
		t.Fatal("expected error for out-of-range index")
	}
}
