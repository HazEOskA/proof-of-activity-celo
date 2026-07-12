// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title OperationReceiptRegistry
/// @notice Stores timestamped artifact-hash receipts for digital work.
/// @dev A receipt proves registration by an address, not the quality of the work.
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

    mapping(bytes32 operationId => Receipt receipt) private receipts;

    error EmptyOperationId();
    error EmptyArtifactHash();
    error ReceiptAlreadyExists(bytes32 operationId);
    error ReceiptNotFound(bytes32 operationId);
    error NotReceiptExecutor(address caller, address executor);
    error ReceiptAlreadyRevoked(bytes32 operationId);

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

        if (receipts[operationId].executor != address(0)) {
            revert ReceiptAlreadyExists(operationId);
        }

        uint64 registeredAt = uint64(block.timestamp);

        receipts[operationId] = Receipt({
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
        Receipt storage receipt = receipts[operationId];

        if (receipt.executor == address(0)) {
            revert ReceiptNotFound(operationId);
        }

        if (msg.sender != receipt.executor) {
            revert NotReceiptExecutor(msg.sender, receipt.executor);
        }

        if (receipt.status == ReceiptStatus.Revoked) {
            revert ReceiptAlreadyRevoked(operationId);
        }

        receipt.status = ReceiptStatus.Revoked;

        emit ReceiptRevoked(
            operationId,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    function getReceipt(
        bytes32 operationId
    )
        external
        view
        returns (
            bytes32 artifactHash,
            address executor,
            uint64 timestamp,
            ReceiptStatus status
        )
    {
        Receipt memory receipt = receipts[operationId];

        if (receipt.executor == address(0)) {
            revert ReceiptNotFound(operationId);
        }

        return (
            receipt.artifactHash,
            receipt.executor,
            receipt.timestamp,
            receipt.status
        );
    }

    function exists(bytes32 operationId) external view returns (bool) {
        return receipts[operationId].executor != address(0);
    }
}
