// server.go — HTTP surface of the ledger.
//
// Deliberately minimal and POSTing JSON only. No auth here — authentication
// is the deployer's concern (reverse-proxy, mTLS, Cloudflare Access, etc).
// The ledger's job is integrity, not access control.
//
// Endpoints
// ---------
//   POST /append        → append a TokenEntry; returns the StoredEntry
//   GET  /head          → current signed tree head
//   GET  /entry?i=N     → the entry at index N
//   GET  /proof?i=N     → inclusion proof for entry N + fresh STH
//   POST /verify        → verify a (leaf, proof, root) triple server-side
//   GET  /healthz       → liveness

package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
)

// Server wires HTTP handlers to a Ledger.
type Server struct {
	l *Ledger
}

// NewServer returns a *Server bound to the given ledger.
func NewServer(l *Ledger) *Server { return &Server{l: l} }

// Routes returns an http.Handler with all endpoints registered.
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.handleHealth)
	mux.HandleFunc("/append", s.handleAppend)
	mux.HandleFunc("/head", s.handleHead)
	mux.HandleFunc("/entry", s.handleEntry)
	mux.HandleFunc("/proof", s.handleProof)
	mux.HandleFunc("/verify", s.handleVerify)
	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"size":   s.l.Size(),
	})
}

func (s *Server) handleAppend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var e TokenEntry
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		http.Error(w, fmt.Sprintf("bad json: %v", err), http.StatusBadRequest)
		return
	}
	se, err := s.l.Append(e)
	if err != nil {
		// Validation errors vs. I/O errors: both bubble up, but we use
		// 400 for the validation ones so callers can distinguish.
		if errors.Is(err, ErrMissingAgentID) || errors.Is(err, ErrMissingHashes) {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, se)
}

func (s *Server) handleHead(w http.ResponseWriter, _ *http.Request) {
	sth, err := s.l.Head()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, sth)
}

func (s *Server) handleEntry(w http.ResponseWriter, r *http.Request) {
	i, err := strconv.Atoi(r.URL.Query().Get("i"))
	if err != nil {
		http.Error(w, "query param 'i' (integer) is required", http.StatusBadRequest)
		return
	}
	se, ok := s.l.Entry(i)
	if !ok {
		http.Error(w, "index out of range", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, se)
}

func (s *Server) handleProof(w http.ResponseWriter, r *http.Request) {
	i, err := strconv.Atoi(r.URL.Query().Get("i"))
	if err != nil {
		http.Error(w, "query param 'i' (integer) is required", http.StatusBadRequest)
		return
	}
	se, ok := s.l.Entry(i)
	if !ok {
		http.Error(w, "index out of range", http.StatusNotFound)
		return
	}
	proof, sth, err := s.l.Proof(i)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"index":      i,
		"leaf_hash":  se.LeafHash,
		"entry":      se.Entry,
		"proof":      proof,
		"signed_head": sth,
	})
}

// verifyRequest is the payload for POST /verify. All fields are hex or JSON
// values that a third-party auditor would already have in hand.
type verifyRequest struct {
	Entry    TokenEntry  `json:"entry"`
	Proof    []ProofStep `json:"proof"`
	RootHash string      `json:"root_hash"` // hex
}

func (s *Server) handleVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req verifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("bad json: %v", err), http.StatusBadRequest)
		return
	}
	leafBytes, err := req.Entry.canonicalJSON()
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	ok := VerifyInclusion(leafBytes, req.Proof, fromHex(req.RootHash))
	writeJSON(w, http.StatusOK, map[string]any{"valid": ok})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
