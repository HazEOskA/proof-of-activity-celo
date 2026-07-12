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