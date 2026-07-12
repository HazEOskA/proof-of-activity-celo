import 'viem/window'

import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  isAddress,
  keccak256,
  toBytes,
} from 'viem'
import type { Address, Hex } from 'viem'

export const CELO_SEPOLIA_CHAIN_ID = 11_142_220
export const REGISTRY_ADDRESS = '0x60F5C6257984bFCF678802529451E30d424df9EE' as const
export const EXPLORER_URL = 'https://celo-sepolia.blockscout.com'

export const celoSepolia = defineChain({
  id: CELO_SEPOLIA_CHAIN_ID,
  name: 'Celo Sepolia',
  nativeCurrency: {
    name: 'CELO',
    symbol: 'CELO',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://forno.celo-sepolia.celo-testnet.org/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Celo Sepolia Blockscout',
      url: EXPLORER_URL,
    },
  },
  testnet: true,
})

export const registryAbi = [
  {
    type: 'function',
    name: 'registerReceipt',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'operationId', type: 'bytes32' },
      { name: 'artifactHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getReceipt',
    stateMutability: 'view',
    inputs: [
      { name: 'executor', type: 'address' },
      { name: 'operationId', type: 'bytes32' },
    ],
    outputs: [
      { name: 'artifactHash', type: 'bytes32' },
      { name: 'receiptExecutor', type: 'address' },
      { name: 'timestamp', type: 'uint64' },
      { name: 'status', type: 'uint8' },
    ],
  },
  {
    type: 'function',
    name: 'exists',
    stateMutability: 'view',
    inputs: [
      { name: 'executor', type: 'address' },
      { name: 'operationId', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export const publicClient = createPublicClient({
  chain: celoSepolia,
  transport: http(celoSepolia.rpcUrls.default.http[0]),
})

export function operationIdFromLabel(label: string): Hex {
  return keccak256(toBytes(label.trim()))
}

export function hashText(value: string): Hex {
  return keccak256(toBytes(value))
}

export async function hashFile(file: File): Promise<Hex> {
  return keccak256(new Uint8Array(await file.arrayBuffer()))
}

export function isExecutorAddress(value: string): value is Address {
  return isAddress(value)
}

export async function connectInjectedWallet(): Promise<Address> {
  if (!window.ethereum) {
    throw new Error('No browser wallet detected. Install MetaMask or another EIP-1193 wallet.')
  }

  const walletClient = createWalletClient({
    chain: celoSepolia,
    transport: custom(window.ethereum),
  })

  const [account] = await walletClient.requestAddresses()

  if (!account) {
    throw new Error('Wallet did not return an account.')
  }

  try {
    await walletClient.switchChain({ id: celoSepolia.id })
  } catch {
    await walletClient.addChain({ chain: celoSepolia })
    await walletClient.switchChain({ id: celoSepolia.id })
  }

  return account
}

export async function registerReceipt(
  account: Address,
  operationId: Hex,
  artifactHash: Hex,
): Promise<Hex> {
  if (!window.ethereum) {
    throw new Error('No browser wallet detected.')
  }

  const walletClient = createWalletClient({
    account,
    chain: celoSepolia,
    transport: custom(window.ethereum),
  })

  const { request } = await publicClient.simulateContract({
    account,
    address: REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: 'registerReceipt',
    args: [operationId, artifactHash],
  })

  return walletClient.writeContract(request)
}

export type ReceiptRecord = {
  artifactHash: Hex
  executor: Address
  timestamp: bigint
  status: 'Active' | 'Revoked'
}

export async function readReceipt(
  executor: Address,
  operationId: Hex,
): Promise<ReceiptRecord | null> {
  const receiptExists = await publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: 'exists',
    args: [executor, operationId],
  })

  if (!receiptExists) {
    return null
  }

  const [artifactHash, receiptExecutor, timestamp, status] = await publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: 'getReceipt',
    args: [executor, operationId],
  })

  return {
    artifactHash,
    executor: receiptExecutor,
    timestamp,
    status: status === 0 ? 'Active' : 'Revoked',
  }
}

export async function waitForReceipt(transactionHash: Hex) {
  return publicClient.waitForTransactionReceipt({ hash: transactionHash })
}

export function compactAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function readableError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unknown error.'
  }

  if (error.message.includes('ReceiptAlreadyExists')) {
    return 'This operation ID already exists for the connected wallet.'
  }

  if (error.message.includes('User rejected') || error.message.includes('rejected the request')) {
    return 'The wallet request was rejected.'
  }

  return error.message.split('\n')[0]
}
