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