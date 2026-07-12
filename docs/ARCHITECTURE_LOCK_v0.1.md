# Architecture Lock v0.1

## Product

Proof of Activity is a verifiable execution receipt system for AI agents, builders and digital work.

## Core Flow

Task -> Artifact -> Artifact Hash -> On-chain Receipt -> Public Verification

## Components

- apps/web: React and TypeScript user interface
- contracts: Solidity receipt registry and automated tests
- packages/shared: ABI, contract addresses and shared types
- docs: architecture, deployment evidence and submission documentation

## Contract v0.1

OperationReceiptRegistry stores:

- operationId
- artifactHash
- executor
- timestamp
- status

## Security Rules

- Never commit private keys, seed phrases or mnemonics
- No mainnet deployment before local and Celo Sepolia validation
- Contract stores hashes and metadata, not private artifact content
- Mainnet deployment requires explicit human approval

## Validation Gates

1. Solidity compilation passes
2. Contract tests pass
3. Local write and read flow passes
4. Celo Sepolia deployment passes
5. Block explorer verification passes
6. Web application reads the deployed receipt
