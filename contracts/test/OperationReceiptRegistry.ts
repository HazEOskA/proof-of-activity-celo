import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { keccak256, stringToHex, zeroHash } from "viem";

describe("OperationReceiptRegistry", async function () {
  const { viem } = await network.create();

  const publicClient = await viem.getPublicClient();
  const [executor, outsider] = await viem.getWalletClients();

  const operationId = keccak256(stringToHex("operation-001"));
  const artifactHash = keccak256(
    stringToHex("artifact-content-v1"),
  );

  async function deployRegistry() {
    return viem.deployContract("OperationReceiptRegistry");
  }

  async function registerReceipt(
    registry: Awaited<ReturnType<typeof deployRegistry>>,
  ) {
    const transactionHash =
      await registry.write.registerReceipt(
        [operationId, artifactHash],
        { account: executor.account },
      );

    await publicClient.waitForTransactionReceipt({
      hash: transactionHash,
    });
  }

  it("registers and returns an active receipt", async function () {
    const registry = await deployRegistry();

    await registerReceipt(registry);

    const receipt =
      await registry.read.getReceipt([operationId]);

    assert.equal(receipt[0], artifactHash);
    assert.equal(
      receipt[1].toLowerCase(),
      executor.account.address.toLowerCase(),
    );
    assert.ok(receipt[2] > 0n);
    assert.equal(receipt[3], 0);
    assert.equal(
      await registry.read.exists([operationId]),
      true,
    );
  });

  it("rejects duplicate operation IDs", async function () {
    const registry = await deployRegistry();

    await registerReceipt(registry);

    await assert.rejects(async () => {
      await registry.write.registerReceipt(
        [operationId, artifactHash],
        { account: executor.account },
      );
    });
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

  it("blocks revocation by a different address", async function () {
    const registry = await deployRegistry();

    await registerReceipt(registry);

    await assert.rejects(async () => {
      await registry.write.revokeReceipt(
        [operationId],
        { account: outsider.account },
      );
    });
  });

  it("allows the executor to revoke their receipt", async function () {
    const registry = await deployRegistry();

    await registerReceipt(registry);

    const transactionHash =
      await registry.write.revokeReceipt(
        [operationId],
        { account: executor.account },
      );

    await publicClient.waitForTransactionReceipt({
      hash: transactionHash,
    });

    const receipt =
      await registry.read.getReceipt([operationId]);

    assert.equal(receipt[3], 1);
  });
});
