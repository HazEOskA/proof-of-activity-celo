# Proof of Activity — Celo

Verifiable execution receipts for AI agents, builders and digital work.

## Core flow

Task → Artifact → Hash → On-chain Receipt → Public Verification

## What works

- structured proof payloads for AI-agent and builder activity,
- deterministic operation IDs and artifact hashes,
- `OperationReceiptRegistry` smart contract,
- receipt registration, lookup and revocation,
- MiniPay-compatible injected-wallet flow,
- deployed and tested on Celo Sepolia,
- Celo mainnet configuration and wallet-signed deployment screen prepared,
- web lint and production build passing.

## Current status

Implementation is complete on Celo Sepolia.

Celo mainnet deployment is **prepared but not yet executed**. It requires one wallet confirmation from the funded deployer address:

`0x410253a590aa8a82c3a9723e1200bc0197457802`

After confirmation, the remaining steps are:

1. record the mainnet contract address and transaction hash,
2. switch the production app from Celo Sepolia to Celo mainnet,
3. execute one live proof transaction,
4. publish the final production deployment and submit to Celo Proof of Ship.
