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