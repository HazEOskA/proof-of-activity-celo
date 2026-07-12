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

## Receipt Identity

A receipt is uniquely identified by:

```text
executor address + operation ID
```

Operation IDs are not globally reserved. Two different executors may use the same operation ID.

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
- One executor cannot revoke another executor's receipt

## Validation Gates

1. Solidity compilation passes
2. TypeScript typecheck passes
3. Contract tests pass
4. Local write and read flow passes
5. Celo Sepolia deployment passes
6. Block explorer verification passes
7. Web application reads the deployed receipt