// merkle.go — RFC 6962-style Merkle tree with inclusion proofs.
//
// We reuse the domain separation from RFC 6962 (Certificate Transparency):
//
//	leafHash(x)        = SHA-256( 0x00 || x )
//	internalHash(l, r) = SHA-256( 0x01 || l || r )
//
// This prevents second-preimage attacks where an internal node hash is
// mistaken for a leaf hash. The exact scheme has been battle-tested in
// public CT logs for over a decade, which is why we don't invent our own.
//
// Inclusion proofs are annotated with a Left/Right flag so verification
// is a straight walk up the tree — no index arithmetic, no ambiguity,
// and any client (Python, JS, Go) can verify with a ten-line function.

package main

import (
	"bytes"
	"crypto/sha256"
	"fmt"
)

// leafHash computes the RFC 6962 leaf hash.
func leafHash(payload []byte) []byte {
	h := sha256.New()
	h.Write([]byte{0x00})
	h.Write(payload)
	return h.Sum(nil)
}

// internalHash computes the RFC 6962 internal node hash.
func internalHash(left, right []byte) []byte {
	h := sha256.New()
	h.Write([]byte{0x01})
	h.Write(left)
	h.Write(right)
	return h.Sum(nil)
}

// emptyRoot is the hash of an empty tree — by convention SHA-256 of the
// empty byte string.
func emptyRoot() []byte {
	h := sha256.Sum256(nil)
	return h[:]
}

// MerkleTree is an in-memory, append-only Merkle tree over leaf hashes.
//
// We store the leaf hashes (not the raw leaves) because that is all we
// ever need to compute the root or an inclusion proof. The raw leaves
// live in the append-only store on disk.
type MerkleTree struct {
	leafHashes [][]byte
}

// AppendLeaf adds a new leaf by hashing its raw bytes.
func (m *MerkleTree) AppendLeaf(leafBytes []byte) {
	m.leafHashes = append(m.leafHashes, leafHash(leafBytes))
}

// AppendLeafHash adds a pre-computed leaf hash (used on reload).
func (m *MerkleTree) AppendLeafHash(lh []byte) {
	m.leafHashes = append(m.leafHashes, append([]byte(nil), lh...))
}

// Size returns the number of leaves currently in the tree.
func (m *MerkleTree) Size() int { return len(m.leafHashes) }

// Root returns the current Merkle root.
func (m *MerkleTree) Root() []byte {
	if len(m.leafHashes) == 0 {
		return emptyRoot()
	}
	return merkleTreeHash(m.leafHashes)
}

// merkleTreeHash recursively computes the tree hash, splitting at the
// largest power of two strictly less than n (per RFC 6962 §2.1).
func merkleTreeHash(leafHashes [][]byte) []byte {
	n := len(leafHashes)
	if n == 0 {
		return emptyRoot()
	}
	if n == 1 {
		return leafHashes[0]
	}
	k := largestPowerOfTwoLessThan(n)
	return internalHash(
		merkleTreeHash(leafHashes[:k]),
		merkleTreeHash(leafHashes[k:]),
	)
}

// largestPowerOfTwoLessThan returns the largest k such that k < n and
// k is a power of two. Precondition: n >= 2.
func largestPowerOfTwoLessThan(n int) int {
	k := 1
	for k<<1 < n {
		k <<= 1
	}
	return k
}

// ProofStep is one sibling hash on the path from a leaf to the root,
// annotated with which side it sits on relative to the running hash.
type ProofStep struct {
	Hash string `json:"hash"`           // hex-encoded sibling hash
	Left bool   `json:"left"`           // true ⇒ sibling is the LEFT child
}

// InclusionProof returns an audit path for the leaf at index i.
//
// The returned slice orders steps from the leaf upward toward the root,
// with Left indicating on which side the sibling sits.
func (m *MerkleTree) InclusionProof(i int) ([]ProofStep, error) {
	n := len(m.leafHashes)
	if i < 0 || i >= n {
		return nil, fmt.Errorf("index %d out of range [0, %d)", i, n)
	}
	return subproof(i, m.leafHashes), nil
}

// subproof builds the path bottom-up for leaf at index i within leaves.
func subproof(i int, leaves [][]byte) []ProofStep {
	n := len(leaves)
	if n <= 1 {
		return nil
	}
	k := largestPowerOfTwoLessThan(n)
	if i < k {
		// We're in the left subtree; the sibling is the right subtree's root.
		sibling := merkleTreeHash(leaves[k:])
		return append(subproof(i, leaves[:k]), ProofStep{Hash: toHex(sibling), Left: false})
	}
	// We're in the right subtree; the sibling is the left subtree's root.
	sibling := merkleTreeHash(leaves[:k])
	return append(subproof(i-k, leaves[k:]), ProofStep{Hash: toHex(sibling), Left: true})
}

// VerifyInclusion checks whether leafBytes at index i (in a tree of any
// size) is authenticated by proof under the given root.
//
// Any client — Go, Python, JS — can reimplement this in roughly ten lines;
// that portability is the whole point of the RFC 6962 design.
func VerifyInclusion(leafBytes []byte, proof []ProofStep, wantRoot []byte) bool {
	running := leafHash(leafBytes)
	for _, step := range proof {
		sib := fromHex(step.Hash)
		if step.Left {
			running = internalHash(sib, running)
		} else {
			running = internalHash(running, sib)
		}
	}
	return bytes.Equal(running, wantRoot)
}
