Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$expectedBranch = "feature/hardhat-baseline"
$currentBranch = git branch --show-current

if ($currentBranch -ne $expectedBranch) {
  throw "STOP: expected branch '$expectedBranch', current branch is '$currentBranch'"
}

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$Content
  )

  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $directory = [System.IO.Path]::GetDirectoryName($fullPath)

  if (-not (Test-Path $directory)) {
    New-Item -ItemType Directory -Force $directory | Out-Null
  }

  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($fullPath, $Content, $encoding)
}

$removePaths = @(
  ".\contracts\.agents",
  ".\contracts\.claude",
  ".\contracts\AGENTS.md",
  ".\contracts\CLAUDE.md",
  ".\contracts\scripts\send-op-tx.ts"
)

foreach ($path in $removePaths) {
  if (Test-Path $path) {
    Remove-Item -Recurse -Force $path
  }
}

$contract = @'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title OperationReceiptRegistry
/// @notice Stores timestamped artifact-hash receipts for digital work.
/// @dev Receipts are uniquely identified by executor address and operation ID.
contract OperationReceiptRegistry {
    enum ReceiptStatus {
        Active,
        Revoked
    }

    struct Receipt {
        bytes32 artifactHash;
        address executor;
        uint64 timestamp;
        ReceiptStatus status;
    }

    mapping(address executor => mapping(bytes32 operationId => Receipt receipt))
        private receipts;

    error EmptyOperationId();
    error EmptyArtifactHash();
    error ReceiptAlreadyExists(address executor, bytes32 operationId);
    error ReceiptNotFound(address executor, bytes32 operationId);
    error ReceiptAlreadyRevoked(address executor, bytes32 operationId);

    event ReceiptRegistered(
        bytes32 indexed operationId,
        bytes32 indexed artifactHash,
        address indexed executor,
        uint64 timestamp
    );

    event ReceiptRevoked(
        bytes32 indexed operationId,
        address indexed executor,
        uint64 timestamp
    );

    function registerReceipt(
        bytes32 operationId,
        bytes32 artifactHash
    ) external {
        if (operationId == bytes32(0)) {
            revert EmptyOperationId();
        }

        if (artifactHash == bytes32(0)) {
            revert EmptyArtifactHash();
        }

        if (receipts[msg.sender][operationId].executor != address(0)) {
            revert ReceiptAlreadyExists(msg.sender, operationId);
        }

        uint64 registeredAt = uint64(block.timestamp);

        receipts[msg.sender][operationId] = Receipt({
            artifactHash: artifactHash,
            executor: msg.sender,
            timestamp: registeredAt,
            status: ReceiptStatus.Active
        });

        emit ReceiptRegistered(
            operationId,
            artifactHash,
            msg.sender,
            registeredAt
        );
    }

    function revokeReceipt(bytes32 operationId) external {
        Receipt storage receipt = receipts[msg.sender][operationId];

        if (receipt.executor == address(0)) {
            revert ReceiptNotFound(msg.sender, operationId);
        }

        if (receipt.status == ReceiptStatus.Revoked) {
            revert ReceiptAlreadyRevoked(msg.sender, operationId);
        }

        receipt.status = ReceiptStatus.Revoked;

        emit ReceiptRevoked(
            operationId,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    function getReceipt(
        address executor,
        bytes32 operationId
    )
        external
        view
        returns (
            bytes32 artifactHash,
            address receiptExecutor,
            uint64 timestamp,
            ReceiptStatus status
        )
    {
        Receipt memory receipt = receipts[executor][operationId];

        if (receipt.executor == address(0)) {
            revert ReceiptNotFound(executor, operationId);
        }

        return (
            receipt.artifactHash,
            receipt.executor,
            receipt.timestamp,
            receipt.status
        );
    }

    function exists(
        address executor,
        bytes32 operationId
    ) external view returns (bool) {
        return receipts[executor][operationId].executor != address(0);
    }
}
'@

Write-Utf8NoBom ".\contracts\contracts\OperationReceiptRegistry.sol" $contract

$tests = @'
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { keccak256, stringToHex, zeroHash } from "viem";

describe("OperationReceiptRegistry", async function () {
  const { viem } = await network.create();

  const publicClient = await viem.getPublicClient();
  const [executor, outsider] = await viem.getWalletClients();

  const operationId = keccak256(stringToHex("operation-001"));
  const artifactHash = keccak256(stringToHex("artifact-content-v1"));
  const secondArtifactHash = keccak256(stringToHex("artifact-content-v2"));

  async function deployRegistry() {
    return viem.deployContract("OperationReceiptRegistry");
  }

  async function registerReceipt(
    registry: Awaited<ReturnType<typeof deployRegistry>>,
    wallet: typeof executor,
    hash = artifactHash,
  ) {
    const transactionHash = await registry.write.registerReceipt(
      [operationId, hash],
      { account: wallet.account },
    );

    await publicClient.waitForTransactionReceipt({
      hash: transactionHash,
    });
  }

  it("registers and returns an active receipt", async function () {
    const registry = await deployRegistry();

    await registerReceipt(registry, executor);

    const receipt = await registry.read.getReceipt([
      executor.account.address,
      operationId,
    ]);

    assert.equal(receipt[0], artifactHash);
    assert.equal(
      receipt[1].toLowerCase(),
      executor.account.address.toLowerCase(),
    );
    assert.ok(receipt[2] > 0n);
    assert.equal(receipt[3], 0);
    assert.equal(
      await registry.read.exists([
        executor.account.address,
        operationId,
      ]),
      true,
    );
  });

  it("rejects duplicate IDs inside one executor namespace", async function () {
    const registry = await deployRegistry();

    await registerReceipt(registry, executor);

    await assert.rejects(async () => {
      await registry.write.registerReceipt(
        [operationId, secondArtifactHash],
        { account: executor.account },
      );
    });
  });

  it("allows two executors to use the same operation ID", async function () {
    const registry = await deployRegistry();

    await registerReceipt(registry, executor, artifactHash);
    await registerReceipt(registry, outsider, secondArtifactHash);

    const firstReceipt = await registry.read.getReceipt([
      executor.account.address,
      operationId,
    ]);

    const secondReceipt = await registry.read.getReceipt([
      outsider.account.address,
      operationId,
    ]);

    assert.equal(firstReceipt[0], artifactHash);
    assert.equal(secondReceipt[0], secondArtifactHash);
  });

  it("rejects empty IDs and empty artifact hashes", async function () {
    const registry = await deployRegistry();

    await assert.rejects(async () => {
      await registry.write.registerReceipt(
        [zeroHash, artifactHash],
        { account: executor.account },
      );
    });

    await assert.rejects(async () => {
      await registry.write.registerReceipt(
        [operationId, zeroHash],
        { account: executor.account },
      );
    });
  });

  it("does not let another executor revoke the receipt", async function () {
    const registry = await deployRegistry();

    await registerReceipt(registry, executor);

    await assert.rejects(async () => {
      await registry.write.revokeReceipt(
        [operationId],
        { account: outsider.account },
      );
    });

    const receipt = await registry.read.getReceipt([
      executor.account.address,
      operationId,
    ]);

    assert.equal(receipt[3], 0);
  });

  it("allows the executor to revoke their receipt", async function () {
    const registry = await deployRegistry();

    await registerReceipt(registry, executor);

    const transactionHash = await registry.write.revokeReceipt(
      [operationId],
      { account: executor.account },
    );

    await publicClient.waitForTransactionReceipt({
      hash: transactionHash,
    });

    const receipt = await registry.read.getReceipt([
      executor.account.address,
      operationId,
    ]);

    assert.equal(receipt[3], 1);
  });
});
'@

Write-Utf8NoBom ".\contracts\test\OperationReceiptRegistry.ts" $tests

$config = @'
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],

  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },

  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
  },
});
'@

Write-Utf8NoBom ".\contracts\hardhat.config.ts" $config

$contractsReadme = @'
# Operation Receipt Registry Contracts

Solidity contracts and automated tests for the Proof of Activity protocol.

## Receipt identity

Each receipt is uniquely identified by:

```text
executor address + operation ID
```

Different executors may use the same operation ID without blocking one another.

## Commands

Install dependencies:

```shell
npm install
```

Run the complete local validation gate:

```shell
npm run validate
```

Individual commands:

```shell
npm run compile
npm run typecheck
npm test
```

## Safety

- Never commit private keys or seed phrases.
- No mainnet deployment before local and Celo Sepolia validation.
- Only hashes and public metadata belong on-chain.
'@

Write-Utf8NoBom ".\contracts\README.md" $contractsReadme

$architecture = @'
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
'@

Write-Utf8NoBom ".\docs\ARCHITECTURE_LOCK_v0.1.md" $architecture

$proofModel = @'
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
'@

Write-Utf8NoBom ".\docs\PROOF_MODEL_v0.1.md" $proofModel

$packagePath = ".\contracts\package.json"
$packageJson = Get-Content $packagePath -Raw | ConvertFrom-Json

if ($null -ne $packageJson.devDependencies) {
  $packageJson.devDependencies.PSObject.Properties.Remove("forge-std")
}

$scripts = [ordered]@{
  compile = "hardhat compile"
  typecheck = "tsc --noEmit"
  test = "hardhat test"
  validate = "npm run compile && npm run typecheck && npm test"
}

$packageJson | Add-Member -NotePropertyName scripts -NotePropertyValue $scripts -Force
Write-Utf8NoBom $packagePath ($packageJson | ConvertTo-Json -Depth 10)

Push-Location ".\contracts"

try {
  npm install

  if ($LASTEXITCODE -ne 0) {
    throw "npm install failed"
  }

  npx hardhat clean

  if ($LASTEXITCODE -ne 0) {
    throw "hardhat clean failed"
  }

  npm run validate

  if ($LASTEXITCODE -ne 0) {
    throw "contract validation failed"
  }
}
finally {
  Pop-Location
}

git diff --check

if ($LASTEXITCODE -ne 0) {
  throw "git diff check failed"
}

Write-Host "`nREGISTRY NAMESPACE + CLEANUP PASS`n" -ForegroundColor Green
git diff --stat
git status --short
