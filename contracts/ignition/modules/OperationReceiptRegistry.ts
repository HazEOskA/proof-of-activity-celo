import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule(
  "OperationReceiptRegistryModule",
  (moduleBuilder) => {
    const registry = moduleBuilder.contract(
      "OperationReceiptRegistry",
    );

    return { registry };
  },
);
