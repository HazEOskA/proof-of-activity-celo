# Proof Model v0.1

## What the receipt proves

An address registered a specific artifact hash under a specific operation ID at a blockchain timestamp.

## What the receipt does not prove

- that the artifact is high quality,
- that the task was completed correctly,
- that the wallet owner has a specific real-world identity,
- that the artifact itself is publicly available.

## Verification flow

1. Obtain the original artifact.
2. Recalculate its cryptographic hash.
3. Read the receipt from the registry.
4. Compare the calculated hash with the stored artifact hash.
5. Confirm that the receipt status is Active.

## Privacy

Only identifiers, hashes, wallet addresses and timestamps are stored on-chain. Private artifact contents must never be stored in the contract.
