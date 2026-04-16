// signing.go — Ed25519 signing of Signed Tree Heads (STHs).
//
// A Signed Tree Head is a compact, signed promise from the log operator:
// "at timestamp T, my log has size N and Merkle root R." Anyone can
// verify an inclusion proof *against* an STH without trusting the log
// operator — they only need to trust that the operator will not
// fork-sign conflicting STHs, which is detectable via gossip or via
// periodic on-chain anchoring.
//
// This mirrors how Certificate Transparency logs work; the audit model
// is mature and widely deployed.

package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"time"
)

// Signer wraps an Ed25519 keypair used to sign tree heads.
type Signer struct {
	priv ed25519.PrivateKey
	pub  ed25519.PublicKey
}

// LoadOrCreateSigner reads a hex-encoded Ed25519 seed from `path`. If the
// file does not exist, it generates a fresh keypair and writes the seed
// with 0600 permissions.
//
// The seed (32 bytes) fully determines the keypair — this is the
// canonical Ed25519 serialisation. Storing the seed rather than the full
// private key keeps the on-disk footprint minimal and interoperable.
func LoadOrCreateSigner(path string) (*Signer, error) {
	if data, err := os.ReadFile(path); err == nil {
		seed, err := hex.DecodeString(string(bytesTrimSpace(data)))
		if err != nil {
			return nil, fmt.Errorf("decode seed at %s: %w", path, err)
		}
		if len(seed) != ed25519.SeedSize {
			return nil, fmt.Errorf("seed at %s has wrong length %d (want %d)",
				path, len(seed), ed25519.SeedSize)
		}
		priv := ed25519.NewKeyFromSeed(seed)
		return &Signer{priv: priv, pub: priv.Public().(ed25519.PublicKey)}, nil
	}

	// No existing key — generate one.
	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generate ed25519 key: %w", err)
	}
	seed := priv.Seed()
	if err := os.WriteFile(path, []byte(hex.EncodeToString(seed)+"\n"), 0o600); err != nil {
		return nil, fmt.Errorf("persist seed at %s: %w", path, err)
	}
	return &Signer{priv: priv, pub: priv.Public().(ed25519.PublicKey)}, nil
}

// PublicKeyHex returns the signer's public key as hex.
func (s *Signer) PublicKeyHex() string { return hex.EncodeToString(s.pub) }

// SignedTreeHead is a signed commitment to the ledger's state.
//
// A verifier checks:
//  1. signature == Ed25519Verify(pubkey, canonical({tree_size, root_hash, timestamp}))
//  2. any inclusion proof they hold reconstructs to root_hash
//
// The STH is the anchor that can (optionally) be published on-chain for
// external consensus: a single 32-byte root hash per epoch, regardless
// of how many thousands of decisions the ledger has recorded.
type SignedTreeHead struct {
	TreeSize  uint64 `json:"tree_size"`
	RootHash  string `json:"root_hash"`  // hex
	Timestamp int64  `json:"timestamp"`  // unix seconds
	PublicKey string `json:"public_key"` // hex
	Signature string `json:"signature"`  // hex
}

// Sign produces a SignedTreeHead over the given size + root.
func (s *Signer) Sign(treeSize uint64, rootHash []byte) (SignedTreeHead, error) {
	sth := SignedTreeHead{
		TreeSize:  treeSize,
		RootHash:  toHex(rootHash),
		Timestamp: time.Now().Unix(),
		PublicKey: s.PublicKeyHex(),
	}
	msg, err := sthSigningInput(sth)
	if err != nil {
		return sth, err
	}
	sth.Signature = hex.EncodeToString(ed25519.Sign(s.priv, msg))
	return sth, nil
}

// VerifySTH verifies a Signed Tree Head against its embedded public key.
//
// Note: "valid signature" only tells you the log operator issued this
// STH. It does NOT tell you they didn't ALSO issue a conflicting one —
// that's what on-chain anchoring and/or gossip protocols are for.
func VerifySTH(sth SignedTreeHead) bool {
	pub, err := hex.DecodeString(sth.PublicKey)
	if err != nil || len(pub) != ed25519.PublicKeySize {
		return false
	}
	sig, err := hex.DecodeString(sth.Signature)
	if err != nil || len(sig) != ed25519.SignatureSize {
		return false
	}
	msg, err := sthSigningInput(sth)
	if err != nil {
		return false
	}
	return ed25519.Verify(pub, msg, sig)
}

// sthSigningInput returns the canonical bytes that are signed / verified.
//
// We sign a JSON object *without* the signature field so the same STH
// can be signed and verified deterministically.
func sthSigningInput(sth SignedTreeHead) ([]byte, error) {
	return json.Marshal(map[string]any{
		"tree_size":  sth.TreeSize,
		"root_hash":  sth.RootHash,
		"timestamp":  sth.Timestamp,
		"public_key": sth.PublicKey,
	})
}

// bytesTrimSpace trims ASCII whitespace from either end of b. Avoids
// pulling in bytes.TrimSpace for a one-off utility.
func bytesTrimSpace(b []byte) []byte {
	start, end := 0, len(b)
	for start < end && isSpace(b[start]) {
		start++
	}
	for end > start && isSpace(b[end-1]) {
		end--
	}
	return b[start:end]
}

func isSpace(c byte) bool {
	return c == ' ' || c == '\t' || c == '\n' || c == '\r'
}
