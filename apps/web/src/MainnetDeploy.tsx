import 'viem/window'

import { useMemo, useState } from 'react'
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  http,
} from 'viem'
import type { Address, Hex } from 'viem'
import { celo } from 'viem/chains'
import { REGISTRY_BYTECODE } from './registryBytecode'

const EXPECTED_DEPLOYER = '0x410253a590aa8a82c3a9723e1200bc0197457802' as Address
const EXPLORER_URL = 'https://celoscan.io'

const publicClient = createPublicClient({
  chain: celo,
  transport: http('https://forno.celo.org/'),
})

type DeployState =
  | { status: 'idle'; message: string }
  | { status: 'working'; message: string }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string }

export default function MainnetDeploy() {
  const [account, setAccount] = useState<Address | null>(null)
  const [balance, setBalance] = useState<bigint | null>(null)
  const [transactionHash, setTransactionHash] = useState<Hex | null>(null)
  const [contractAddress, setContractAddress] = useState<Address | null>(null)
  const [state, setState] = useState<DeployState>({
    status: 'idle',
    message: 'Ready to deploy OperationReceiptRegistry on Celo mainnet.',
  })

  const balanceLabel = useMemo(
    () => (balance === null ? 'Not checked' : `${Number(formatEther(balance)).toFixed(4)} CELO`),
    [balance],
  )

  async function deploy() {
    if (!window.ethereum) {
      setState({
        status: 'error',
        message: 'Open this page inside MetaMask Mobile browser.',
      })
      return
    }

    setState({ status: 'working', message: 'Connecting MetaMask…' })

    try {
      const walletClient = createWalletClient({
        chain: celo,
        transport: custom(window.ethereum),
      })

      const [connectedAccount] = await walletClient.requestAddresses()
      if (!connectedAccount) throw new Error('MetaMask did not return an account.')

      setAccount(connectedAccount)

      if (connectedAccount.toLowerCase() !== EXPECTED_DEPLOYER.toLowerCase()) {
        throw new Error(
          `Wrong wallet. Select ${EXPECTED_DEPLOYER.slice(0, 8)}…${EXPECTED_DEPLOYER.slice(-6)} in MetaMask.`,
        )
      }

      try {
        await walletClient.switchChain({ id: celo.id })
      } catch {
        await walletClient.addChain({ chain: celo })
        await walletClient.switchChain({ id: celo.id })
      }

      const currentBalance = await publicClient.getBalance({ address: connectedAccount })
      setBalance(currentBalance)
      if (currentBalance === 0n) throw new Error('This wallet has no CELO for gas.')

      setState({
        status: 'working',
        message: 'Confirm the contract deployment transaction in MetaMask.',
      })

      const hash = await walletClient.deployContract({
        account: connectedAccount,
        abi: [],
        bytecode: REGISTRY_BYTECODE,
      })

      setTransactionHash(hash)
      setState({ status: 'working', message: 'Transaction sent. Waiting for confirmation…' })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (!receipt.contractAddress) throw new Error('Deployment confirmed without a contract address.')

      setContractAddress(receipt.contractAddress)
      setState({
        status: 'success',
        message: 'OperationReceiptRegistry deployed successfully on Celo mainnet.',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : 'Unknown deployment error.'
      setState({ status: 'error', message })
    }
  }

  const working = state.status === 'working'

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <span style={styles.kicker}>CELO MAINNET · CHAIN ID 42220</span>
        <h1 style={styles.title}>Deploy Proof of Activity Registry</h1>
        <p style={styles.copy}>
          This screen deploys one immutable OperationReceiptRegistry contract from the funded
          MetaMask wallet. It never reads or stores your seed phrase or private key.
        </p>

        <div style={styles.details}>
          <div style={styles.row}>
            <span style={styles.label}>Required wallet</span>
            <code style={styles.value}>{EXPECTED_DEPLOYER}</code>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Connected wallet</span>
            <code style={styles.value}>{account ?? 'Not connected'}</code>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Balance</span>
            <code style={styles.value}>{balanceLabel}</code>
          </div>
        </div>

        <button type="button" onClick={deploy} disabled={working || Boolean(contractAddress)} style={styles.button}>
          {contractAddress ? 'Deployment complete' : working ? 'Working…' : 'Connect MetaMask & deploy'}
        </button>

        <div style={{ ...styles.notice, ...(state.status === 'error' ? styles.error : {}) }}>
          {state.message}
        </div>

        {transactionHash && (
          <a
            href={`${EXPLORER_URL}/tx/${transactionHash}`}
            target="_blank"
            rel="noreferrer"
            style={styles.link}
          >
            View deployment transaction ↗
          </a>
        )}

        {contractAddress && (
          <div style={styles.successBox}>
            <strong>MAINNET CONTRACT</strong>
            <code>{contractAddress}</code>
            <a
              href={`${EXPLORER_URL}/address/${contractAddress}`}
              target="_blank"
              rel="noreferrer"
              style={styles.link}
            >
              View contract on explorer ↗
            </a>
          </div>
        )}
      </section>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: 20,
    background: '#07090d',
    color: '#f4f7f1',
  },
  card: {
    width: 'min(720px, 100%)',
    padding: 'clamp(22px, 5vw, 44px)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 24,
    background: 'linear-gradient(180deg, rgba(18,22,29,.98), rgba(10,13,18,.98))',
    boxShadow: '0 30px 90px rgba(0,0,0,.4)',
  },
  kicker: {
    color: '#aeff5b',
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '.14em',
  },
  title: {
    margin: '18px 0 14px',
    fontSize: 'clamp(34px, 8vw, 58px)',
    lineHeight: 1,
    letterSpacing: '-.05em',
  },
  copy: {
    color: '#a4acb7',
    lineHeight: 1.7,
  },
  details: {
    margin: '28px 0',
    borderTop: '1px solid rgba(255,255,255,.1)',
  },
  row: {
    display: 'grid',
    gap: 8,
    padding: '15px 0',
    borderBottom: '1px solid rgba(255,255,255,.08)',
  },
  label: {
    color: '#727d89',
    fontSize: 11,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  value: {
    overflowWrap: 'anywhere',
    color: '#f4f7f1',
    fontSize: 12,
  },
  button: {
    width: '100%',
    minHeight: 56,
    border: 0,
    borderRadius: 14,
    color: '#11150f',
    background: 'linear-gradient(90deg, #ffe34f, #aeff5b)',
    fontWeight: 900,
    cursor: 'pointer',
  },
  notice: {
    marginTop: 18,
    padding: 14,
    border: '1px solid rgba(174,255,91,.2)',
    borderRadius: 12,
    color: '#c9ffb5',
    background: 'rgba(174,255,91,.05)',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 1.5,
  },
  error: {
    borderColor: 'rgba(255,105,91,.25)',
    color: '#ffb4aa',
    background: 'rgba(255,105,91,.05)',
  },
  link: {
    display: 'inline-flex',
    marginTop: 16,
    color: '#ffe34f',
    fontFamily: 'monospace',
    fontSize: 12,
    textDecoration: 'none',
  },
  successBox: {
    display: 'grid',
    gap: 10,
    marginTop: 20,
    padding: 16,
    border: '1px solid rgba(174,255,91,.28)',
    borderRadius: 14,
    overflowWrap: 'anywhere',
    background: 'rgba(174,255,91,.06)',
  },
}
