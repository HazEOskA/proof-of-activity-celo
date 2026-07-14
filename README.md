# Proof of Activity — Celo

Verifiable execution receipts for AI agents, builders and digital work.

## Core flow

Task → Agent → Acceptance Criteria → Result → Hash → On-chain Receipt → Public Verification

## Live deployment

- Network: **Celo mainnet**
- Chain ID: `42220`
- Contract: `OperationReceiptRegistry`
- Registry address: `0x23df5bd2abe4072ee63f93c4de817172eb9431df`
- Explorer: `https://celoscan.io/address/0x23df5bd2abe4072ee63f93c4de817172eb9431df`
- Production app: `https://proof-of-activity-celo-preview-42tho4ftn.vercel.app`

## What works

- structured proof payloads for AI-agent and builder activity,
- deterministic operation IDs and execution hashes,
- optional local file hashing without uploading the evidence,
- receipt registration on Celo mainnet,
- public receipt lookup by executor and operation label,
- active/revoked receipt status decoding,
- MiniPay-compatible injected-wallet flow,
- automatic Celo mainnet wallet switching for standard EVM wallets,
- CeloScan transaction and contract links,
- responsive production interface.

## Privacy model

Task descriptions, acceptance criteria, execution results and evidence files remain off-chain. The application writes only a deterministic execution hash and the public receipt metadata required for independent verification.

## Current status

Celo mainnet contract deployment: **complete**.

Production application deployment: **complete**.

Remaining submission validation:

1. execute one live `registerReceipt` transaction from the production application,
2. verify the resulting receipt through the public Verify Proof flow,
3. submit the project to Celo Proof of Ship on Talent.
