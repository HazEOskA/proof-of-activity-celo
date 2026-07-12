import { useMemo, useState } from 'react'
import type { Address, Hex } from 'viem'
import './App.css'
import {
  EXPLORER_URL,
  REGISTRY_ADDRESS,
  compactAddress,
  connectInjectedWallet,
  hashFile,
  hashText,
  isExecutorAddress,
  operationIdFromLabel,
  readReceipt,
  readableError,
  registerReceipt,
  waitForReceipt,
} from './blockchain'
import type { ReceiptRecord } from './blockchain'

type View = 'create' | 'verify'
type Notice = { tone: 'success' | 'error' | 'info'; message: string } | null

function App() {
  const [view, setView] = useState<View>('create')
  const [account, setAccount] = useState<Address | null>(null)
  const [operationLabel, setOperationLabel] = useState('portfolio-build-v1')
  const [artifactText, setArtifactText] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileHash, setFileHash] = useState<Hex | null>(null)
  const [transactionHash, setTransactionHash] = useState<Hex | null>(null)
  const [verifyExecutor, setVerifyExecutor] = useState('')
  const [verifyLabel, setVerifyLabel] = useState('portfolio-build-v1')
  const [verifiedReceipt, setVerifiedReceipt] = useState<ReceiptRecord | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [busy, setBusy] = useState(false)

  const operationId = useMemo(
    () => (operationLabel.trim() ? operationIdFromLabel(operationLabel) : null),
    [operationLabel],
  )

  const textArtifactHash = useMemo(
    () => (artifactText.trim() ? hashText(artifactText) : null),
    [artifactText],
  )

  const artifactHash = fileHash ?? textArtifactHash

  async function handleConnect() {
    setNotice({ tone: 'info', message: 'Waiting for wallet approval…' })

    try {
      const connectedAccount = await connectInjectedWallet()
      setAccount(connectedAccount)
      setVerifyExecutor(connectedAccount)
      setNotice({ tone: 'success', message: 'Wallet connected to Celo Sepolia.' })
      return connectedAccount
    } catch (error) {
      setNotice({ tone: 'error', message: readableError(error) })
      return null
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return

    setNotice({ tone: 'info', message: `Hashing ${file.name} locally…` })

    try {
      const digest = await hashFile(file)
      setFileName(file.name)
      setFileHash(digest)
      setNotice({
        tone: 'success',
        message: 'File hashed in your browser. Its contents are not uploaded.',
      })
    } catch (error) {
      setNotice({ tone: 'error', message: readableError(error) })
    }
  }

  function clearFile() {
    setFileName('')
    setFileHash(null)
    setNotice(null)
  }

  async function handleCreateProof() {
    setNotice(null)
    setTransactionHash(null)

    if (!operationId) {
      setNotice({ tone: 'error', message: 'Enter an operation label.' })
      return
    }

    if (!artifactHash) {
      setNotice({ tone: 'error', message: 'Add artifact text or choose a file.' })
      return
    }

    const activeAccount = account ?? (await handleConnect())
    if (!activeAccount) return

    setBusy(true)
    setNotice({ tone: 'info', message: 'Confirm the transaction in your wallet…' })

    try {
      const hash = await registerReceipt(activeAccount, operationId, artifactHash)
      setTransactionHash(hash)
      setNotice({ tone: 'info', message: 'Transaction submitted. Waiting for confirmation…' })
      await waitForReceipt(hash)
      setVerifyExecutor(activeAccount)
      setVerifyLabel(operationLabel)
      setNotice({
        tone: 'success',
        message: 'Proof registered on Celo Sepolia. The receipt is publicly verifiable.',
      })
    } catch (error) {
      setNotice({ tone: 'error', message: readableError(error) })
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyProof() {
    setNotice(null)
    setVerifiedReceipt(null)

    if (!isExecutorAddress(verifyExecutor)) {
      setNotice({ tone: 'error', message: 'Enter a valid executor wallet address.' })
      return
    }

    if (!verifyLabel.trim()) {
      setNotice({ tone: 'error', message: 'Enter the original operation label.' })
      return
    }

    setBusy(true)
    setNotice({ tone: 'info', message: 'Reading the public receipt from Celo Sepolia…' })

    try {
      const receipt = await readReceipt(verifyExecutor, operationIdFromLabel(verifyLabel))

      if (!receipt) {
        setNotice({ tone: 'error', message: 'No receipt exists for this executor and operation ID.' })
        return
      }

      setVerifiedReceipt(receipt)
      setNotice({ tone: 'success', message: 'Receipt found and decoded from the registry.' })
    } catch (error) {
      setNotice({ tone: 'error', message: readableError(error) })
    } finally {
      setBusy(false)
    }
  }

  async function copyValue(value: string) {
    await navigator.clipboard.writeText(value)
    setNotice({ tone: 'success', message: 'Copied to clipboard.' })
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Proof of Activity home">
          <span className="brand-mark">OA</span>
          <span>
            <strong>Proof of Activity</strong>
            <small>Verifiable execution receipts</small>
          </span>
        </a>

        <div className="network-cluster">
          <span className="network-pill">
            <span className="network-dot" /> Celo Sepolia
          </span>
          <button className="wallet-button" type="button" onClick={handleConnect}>
            {account ? compactAddress(account) : 'Connect wallet'}
          </button>
        </div>
      </header>

      <section className="hero-section" id="top">
        <div className="eyebrow">TASK → ARTIFACT → HASH → RECEIPT</div>
        <h1>Turn digital work into a public, verifiable receipt.</h1>
        <p>
          Hash an artifact locally, register its proof on Celo, and let anyone verify the
          executor, timestamp, status, and artifact fingerprint.
        </p>
        <div className="proof-path" aria-label="Proof flow">
          <span>01 Create</span>
          <i />
          <span>02 Sign</span>
          <i />
          <span>03 Verify</span>
        </div>
      </section>

      <section className="workspace">
        <div className="workspace-heading">
          <div>
            <span className="section-kicker">LIVE TESTNET MVP</span>
            <h2>Receipt Console</h2>
          </div>
          <div className="view-tabs" role="tablist" aria-label="Receipt actions">
            <button
              className={view === 'create' ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={view === 'create'}
              onClick={() => {
                setView('create')
                setNotice(null)
              }}
            >
              Create proof
            </button>
            <button
              className={view === 'verify' ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={view === 'verify'}
              onClick={() => {
                setView('verify')
                setNotice(null)
              }}
            >
              Verify proof
            </button>
          </div>
        </div>

        {view === 'create' ? (
          <div className="console-grid">
            <div className="form-panel">
              <label className="field-label" htmlFor="operation-label">
                Operation label
              </label>
              <input
                id="operation-label"
                value={operationLabel}
                onChange={(event) => setOperationLabel(event.target.value)}
                placeholder="portfolio-build-v1"
              />
              <p className="field-help">
                A readable label converted deterministically into a bytes32 operation ID.
              </p>

              <label className="field-label" htmlFor="artifact-text">
                Artifact content
              </label>
              <textarea
                id="artifact-text"
                value={artifactText}
                onChange={(event) => setArtifactText(event.target.value)}
                placeholder="Paste a build summary, document content, output manifest, or other evidence…"
                disabled={Boolean(fileHash)}
              />

              <div className="divider"><span>OR</span></div>

              <label className={`file-drop ${fileHash ? 'has-file' : ''}`}>
                <input
                  type="file"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
                <span className="file-icon">↥</span>
                <span>
                  <strong>{fileName || 'Choose an artifact file'}</strong>
                  <small>
                    {fileHash ? 'File hash ready' : 'Hashed locally — file contents stay on your device'}
                  </small>
                </span>
                {fileHash && (
                  <button type="button" className="clear-file" onClick={clearFile}>
                    Clear
                  </button>
                )}
              </label>

              <button
                className="primary-action"
                type="button"
                onClick={handleCreateProof}
                disabled={busy}
              >
                {busy ? 'Processing…' : account ? 'Create on-chain proof' : 'Connect & create proof'}
                <span>→</span>
              </button>
            </div>

            <aside className="receipt-preview">
              <div className="preview-header">
                <span>RECEIPT PREVIEW</span>
                <span className="status-chip">UNSIGNED</span>
              </div>
              <dl>
                <div>
                  <dt>Executor</dt>
                  <dd>{account ?? 'Connect wallet'}</dd>
                </div>
                <div>
                  <dt>Operation ID</dt>
                  <dd>{operationId ?? 'Waiting for label'}</dd>
                </div>
                <div>
                  <dt>Artifact hash</dt>
                  <dd>{artifactHash ?? 'Waiting for artifact'}</dd>
                </div>
                <div>
                  <dt>Registry</dt>
                  <dd>{REGISTRY_ADDRESS}</dd>
                </div>
              </dl>
              <p className="privacy-note">
                Only hashes and public receipt metadata go on-chain. Artifact contents remain
                outside the registry.
              </p>
            </aside>
          </div>
        ) : (
          <div className="console-grid verify-grid">
            <div className="form-panel">
              <label className="field-label" htmlFor="executor-address">
                Executor address
              </label>
              <input
                id="executor-address"
                value={verifyExecutor}
                onChange={(event) => setVerifyExecutor(event.target.value)}
                placeholder="0x…"
              />

              <label className="field-label" htmlFor="verify-label">
                Operation label
              </label>
              <input
                id="verify-label"
                value={verifyLabel}
                onChange={(event) => setVerifyLabel(event.target.value)}
                placeholder="portfolio-build-v1"
              />
              <p className="field-help">
                Enter the exact original label. The app reconstructs the operation ID locally.
              </p>

              <button
                className="primary-action"
                type="button"
                onClick={handleVerifyProof}
                disabled={busy}
              >
                {busy ? 'Reading registry…' : 'Verify public receipt'}
                <span>⌕</span>
              </button>
            </div>

            <aside className={`receipt-preview verified ${verifiedReceipt ? 'found' : ''}`}>
              <div className="preview-header">
                <span>VERIFICATION RESULT</span>
                <span className="status-chip">
                  {verifiedReceipt ? verifiedReceipt.status.toUpperCase() : 'AWAITING QUERY'}
                </span>
              </div>
              {verifiedReceipt ? (
                <>
                  <dl>
                    <div>
                      <dt>Executor</dt>
                      <dd>
                        {verifiedReceipt.executor}
                        <button type="button" onClick={() => copyValue(verifiedReceipt.executor)}>
                          Copy
                        </button>
                      </dd>
                    </div>
                    <div>
                      <dt>Artifact hash</dt>
                      <dd>
                        {verifiedReceipt.artifactHash}
                        <button type="button" onClick={() => copyValue(verifiedReceipt.artifactHash)}>
                          Copy
                        </button>
                      </dd>
                    </div>
                    <div>
                      <dt>Registered</dt>
                      <dd>{new Date(Number(verifiedReceipt.timestamp) * 1000).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{verifiedReceipt.status}</dd>
                    </div>
                  </dl>
                  <a
                    className="explorer-link"
                    href={`${EXPLORER_URL}/address/${REGISTRY_ADDRESS}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Inspect registry on Blockscout ↗
                  </a>
                </>
              ) : (
                <div className="empty-result">
                  <span>◇</span>
                  <strong>No query executed</strong>
                  <p>Provide the executor and operation label to read the on-chain receipt.</p>
                </div>
              )}
            </aside>
          </div>
        )}

        {notice && <div className={`notice ${notice.tone}`}>{notice.message}</div>}

        {transactionHash && (
          <div className="transaction-row">
            <span>Transaction confirmed</span>
            <a
              href={`${EXPLORER_URL}/tx/${transactionHash}`}
              target="_blank"
              rel="noreferrer"
            >
              {compactAddress(transactionHash)} ↗
            </a>
            <button
              type="button"
              onClick={() => {
                setView('verify')
                setNotice(null)
              }}
            >
              Verify now
            </button>
          </div>
        )}
      </section>

      <footer>
        <span>Proof of Activity · Celo Sepolia</span>
        <a
          href={`${EXPLORER_URL}/address/${REGISTRY_ADDRESS}`}
          target="_blank"
          rel="noreferrer"
        >
          Contract {compactAddress(REGISTRY_ADDRESS)} ↗
        </a>
      </footer>
    </main>
  )
}

export default App
