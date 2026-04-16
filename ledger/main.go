// main.go — notary-ledger: the single Go binary that serves the ledger.
//
//   go run . --log ./ledger.jsonl --key ./ledger.key --addr :8088
//
// The process serves HTTP, owns one JSONL log file, and owns one
// Ed25519 seed file. That's the whole operational footprint — no
// consensus cluster, no validator set, no mempool, no gas.

package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	logPath := flag.String("log", "ledger.jsonl", "path to the append-only JSONL ledger file")
	keyPath := flag.String("key", "ledger.key", "path to the Ed25519 seed file (created if missing)")
	addr := flag.String("addr", ":8088", "HTTP listen address")
	flag.Parse()

	l, err := OpenLedger(*logPath, *keyPath)
	if err != nil {
		log.Fatalf("open ledger: %v", err)
	}
	defer l.Close()

	log.Printf("notary-ledger ready: size=%d pub=%s log=%s addr=%s",
		l.Size(), l.signer.PublicKeyHex(), *logPath, *addr)

	srv := &http.Server{
		Addr:              *addr,
		Handler:           NewServer(l).Routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Graceful shutdown on SIGINT/SIGTERM so the last fsync'd entry is
	// always consistent with the in-memory Merkle tree.
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-shutdown
		log.Printf("shutting down…")
		_ = srv.Close()
	}()

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("http: %v", err)
	}
}
