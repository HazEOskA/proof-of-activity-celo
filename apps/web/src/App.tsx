import { useEffect, useMemo, useRef, useState } from 'react'
import type { Address, Hex } from 'viem'
import './App.css'
import {
  EXPLORER_URL,
  REGISTRY_ADDRESS,
  buildAgentProofPayload,
  compactAddress,
  connectInjectedWallet,
  hashFile,
  hashText,
  isExecutorAddress,
  isMiniPayWallet,
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
  const [miniPay] = useState(() => isMiniPayWallet())
  const [operationLabel, setOperationLabel] = useState('agent-proof-001')
  const [task, setTask] = useState('Build and validate the Proof of Activity MiniPay MVP')
  const [agentName, setAgentName] = useState('OsaTechGPT Builder Agent')
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(
    'Wallet connects, receipt is registered on Celo Sepolia, and the proof can be read back publicly.',
  )
  const [resultText, setResultText] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileHash, setFileHash] = useState<Hex | null>(null)
  const [transactionHash, setTransactionHash] = useState<Hex | null>(null)
  const [verifyExecutor, setVerifyExecutor] = useState('')
  const [verifyLabel, setVerifyLabel] = useState('agent-proof-001')
  const [verifiedReceipt, setVerifiedReceipt] = useState<ReceiptRecord | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [busy, setBusy] = useState(false)
  const miniPayAutoConnectStarted = useRef(false)

  useEffect(() => {
    if (!miniPay || miniPayAutoConnectStarted.current) return

    miniPayAutoConnectStarted.current = true

    void connectInjectedWallet()
      .then((connectedAccount) => {
        setAccount(connectedAccount)
        setVerifyExecutor(connectedAccount)
        setNotice({ tone: 'success', message: 'MiniPay connected on Celo Sepolia.' })
      })
      .catch((error: unknown) => {
        miniPayAutoConnectStarted.current = false
        setNotice({ tone: 'error', message: readableError(error) })
      })
  }, [miniPay])
  const operationId = useMemo(
    () => (operationLabel.trim() ? operationIdFromLabel(operationLabel) : null),
    [operationLabel],
  )

  const proofPayload = useMemo(() => {
    const hasRequiredFields =
      operationLabel.trim() &&
      task.trim() &&
      agentName.trim() &&
      acceptanceCriteria.trim() &&
      (resultText.trim() || fileHash)

    if (!hasRequiredFields) return null

    return buildAgentProofPayload({
      operationLabel,
      task,
      agentName,
      acceptanceCriteria,
      result: resultText,
      fileName: fileName || null,
      fileHash,
    })
  }, [acceptanceCriteria, agentName, fileHash, fileName, operationLabel, resultText, task])

  const artifactHash = useMemo(
    () => (proofPayload ? hashText(proofPayload) : null),
    [proofPayload],
  )

  async function handleConnect() {
    setNotice({ tone: 'info', message: 'Waiting for wallet approval…' })

    try {
      const connectedAccount = await connectInjectedWallet()
      setAccount(connectedAccount)
      setVerifyExecutor(connectedAccount)
      setNotice({
        tone: 'success',
        message: `${isMiniPayWallet() ? 'MiniPay' : 'Wallet'} connected to Celo Sepolia.`,
      })
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
        message: 'Evidence file hashed locally. Its contents were not uploaded.',
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

    if (!task.trim() || !agentName.trim() || !acceptanceCriteria.trim()) {
      setNotice({ tone: 'error', message: 'Complete the task, agent, and acceptance criteria fields.' })
      return
    }

    if (!resultText.trim() && !fileHash) {
      setNotice({ tone: 'error', message: 'Add an execution result or evidence file.' })
      return
    }

    if (!artifactHash) {
      setNotice({ tone: 'error', message: 'The agent proof payload could not be generated.' })
      return
    }

    const activeAccount = account ?? (await handleConnect())
    if (!activeAccount) return

    setBusy(true)
    setNotice({ tone: 'info', message: 'Confirm the agent proof transaction in your wallet…' })

    try {
      const hash = await registerReceipt(activeAccount, operationId, artifactHash)
      setTransactionHash(hash)
      setNotice({ tone: 'info', message: 'Transaction submitted. Waiting for confirmation…' })
      await waitForReceipt(hash)
      setVerifyExecutor(activeAccount)
      setVerifyLabel(operationLabel)
      setNotice({
        tone: 'success',
        message: 'Agent execution proof registered on Celo Sepolia.',
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
    setNotice({ tone: 'info', message: 'Reading the public agent receipt from Celo Sepolia…' })

    try {
      const receipt = await readReceipt(verifyExecutor, operationIdFromLabel(verifyLabel))

      if (!receipt) {
        setNotice({ tone: 'error', message: 'No receipt exists for this executor and operation ID.' })
        return
      }

      setVerifiedReceipt(receipt)
      setNotice({ tone: 'success', message: 'Agent receipt found and decoded from the registry.' })
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
            <small>Agent execution receipts</small>
          </span>
        </a>

        <div className="network-cluster">
          <span className="network-pill">
            <span className="network-dot" /> {miniPay ? 'MiniPay · Celo Sepolia' : 'Celo Sepolia'}
          </span>
          {miniPay ? (
            account && <span className="network-pill">{compactAddress(account)}</span>
          ) : (
            <button className="wallet-button" type="button" onClick={handleConnect}>
              {account ? compactAddress(account) : 'Connect wallet'}
            </button>
          )}
        </div>
      </header>

      <section className="hero-section" id="top">
        <div className="eyebrow">TASK → AGENT → CRITERIA → RESULT → RECEIPT</div>
        <h1>Make AI agent work independently verifiable.</h1>
        <p>
          Define the task, agent, acceptance criteria, and result. The app hashes the complete
          execution record locally and registers a public receipt on Celo.
        </p>
        <div className="proof-path" aria-label="Proof flow">
          <span>01 Define</span>
          <i />
          <span>02 Execute</span>
          <i />
          <span>03 Prove</span>
        </div>
      </section>

      <section className="workspace">
        <div className="workspace-heading">
          <div>
            <span className="section-kicker">MINIPAY-READY TESTNET MVP</span>
            <h2>Agent Proof Console</h2>
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
              Create agent proof
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
                placeholder="agent-proof-001"
              />
              <p className="field-help">
                Unique label for this execution. The same wallet cannot reuse it.
              </p>

              <label className="field-label" htmlFor="task">
                Task
              </label>
              <textarea
                id="task"
                value={task}
                onChange={(event) => setTask(event.target.value)}
                placeholder="What was the agent asked to accomplish?"
              />

              <label className="field-label" htmlFor="agent-name">
                Agent / model
              </label>
              <input
                id="agent-name"
                value={agentName}
                onChange={(event) => setAgentName(event.target.value)}
                placeholder="OsaTechGPT Builder Agent"
              />

              <label className="field-label" htmlFor="acceptance-criteria">
                Acceptance criteria
              </label>
              <textarea
                id="acceptance-criteria"
                value={acceptanceCriteria}
                onChange={(event) => setAcceptanceCriteria(event.target.value)}
                placeholder="What conditions define successful execution?"
              />

              <label className="field-label" htmlFor="result-text">
                Execution result
              </label>
              <textarea
                id="result-text"
                value={resultText}
                onChange={(event) => setResultText(event.target.value)}
                placeholder="Summarize the result, output, validation, or evidence…"
              />

              <div className="divider"><span>OPTIONAL EVIDENCE FILE</span></div>

              <label className={`file-drop ${fileHash ? 'has-file' : ''}`}>
                <input
                  type="file"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
                <span className="file-icon">↥</span>
                <span>
                  <strong>{fileName || 'Choose an evidence file'}</strong>
                  <small>
                    {fileHash ? 'File fingerprint included in proof' : 'Hashed locally — never uploaded'}
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
                {busy
                  ? 'Processing…'
                  : account
                    ? 'Create agent execution proof'
                    : 'Connect & create agent proof'}
                <span>→</span>
              </button>
            </div>

            <aside className="receipt-preview">
              <div className="preview-header">
                <span>AGENT RECEIPT PREVIEW</span>
                <span className="status-chip">UNSIGNED</span>
              </div>
              <dl>
                <div>
                  <dt>Executor</dt>
                  <dd>{account ?? (miniPay ? 'Connecting MiniPay…' : 'Connect wallet')}</dd>
                </div>
                <div>
                  <dt>Agent</dt>
                  <dd>{agentName || 'Waiting for agent'}</dd>
                </div>
                <div>
                  <dt>Task</dt>
                  <dd>{task || 'Waiting for task'}</dd>
                </div>
                <div>
                  <dt>Operation ID</dt>
                  <dd>{operationId ?? 'Waiting for label'}</dd>
                </div>
                <div>
                  <dt>Execution hash</dt>
                  <dd>{artifactHash ?? 'Complete the execution record'}</dd>
                </div>
                <div>
                  <dt>Registry</dt>
                  <dd>{REGISTRY_ADDRESS}</dd>
                </div>
              </dl>
              <p className="privacy-note">
                The task, criteria, result, and optional file fingerprint are combined into one
                deterministic payload. Only its hash and public receipt metadata go on-chain.
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
                placeholder="agent-proof-001"
              />
              <p className="field-help">
                Enter the exact original label to reconstruct the operation ID.
              </p>

              <button
                className="primary-action"
                type="button"
                onClick={handleVerifyProof}
                disabled={busy}
              >
                {busy ? 'Reading registry…' : 'Verify public agent receipt'}
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
                      <dt>Execution hash</dt>
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
                  <p>Provide the executor and operation label to read the on-chain agent receipt.</p>
                </div>
              )}
            </aside>
          </div>
        )}

        {notice && <div className={`notice ${notice.tone}`}>{notice.message}</div>}

        {transactionHash && (
          <div className="transaction-row">
            <span>Agent proof confirmed</span>
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
        <span>Proof of Activity for AI Agents · MiniPay-ready · Celo Sepolia</span>
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
