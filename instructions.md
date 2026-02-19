# Jonathan's Task — Agent Decision Notary Backend

## Current Status
- [x] parser.py — parses real Langfuse trace JSON (tested with sample trace)
- [x] hasher.py — SHA-256 context snapshot hash + decision hash
- [x] notary.py — connects to BSC testnet, calls commit() and resolveOutcome()
- [x] api.py — FastAPI endpoints: POST /create-snapshot, /commit, /resolve, /trigger-reputation
- [x] reputation.py — stub (waiting on ReputationAggregator contract from Christian)
- [x] Full E2E verified on BSC testnet (create → commit → resolve)
- [x] Wallet registered as ERC-8004 agent by Christian

## Deployed Contracts
- ContextSnapshotFactory: 0xfcb5a3fd52d83cc34a3775be23b8d0b581b29036
- ERC-8004 Identity: 0x8004A818BFB912233c491871b3d84c89A494BD9e
- ReputationAggregator: TBD (waiting on Christian)

## Agent Wallet
- Address: 0x7E31519Fc7280FE3F777Ba08f1b944e8ec45E92a
- ERC-8004 registered: ✅

## Verified Testnet Transactions
- Create Snapshot: 0xab9b75082b95fff279f9e8b159caf4b1d2c04acb33d09f64d322b77a5a6c7f96
- Commit:          0x0321aa91503a6b74413ad16b107e2f0d356ea1aa334be585f2d56155b0f9d09c
- Resolve:         0x390cd78dd02a1a71617082aa05f5eb169337748491354349923e70963b597390

## Still TODO
- [ ] Waiting on Christian for ReputationAggregator ABI + address → then uncomment reputation.py
- [ ] Get more sample Langfuse traces from Agnes to test edge cases
