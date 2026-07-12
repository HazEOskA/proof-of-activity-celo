# Proof Model v0.1

## Receipt key

A receipt is queried using:

```text
executor address + operation ID
```

The operation ID is unique only inside the executor's namespace.

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
3. Identify the executor address and operation ID.
4. Read the receipt from the registry.
5. Compare the calculated hash with the stored artifact hash.
6. Confirm that the receipt status is Active.

## Privacy

Only identifiers, hashes, wallet addresses and timestamps are stored on-chain. Private artifact contents must never be stored in the contract.