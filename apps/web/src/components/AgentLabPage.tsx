import { useState } from 'react'
import { agentApi } from '../api'
import type { AgentResponse } from '../types'

export function AgentLabPage() {
  const [message, setMessage] = useState('How do I reserve a room?')
  const [result, setResult] = useState<AgentResponse | null>(null)
  const [error, setError] = useState('')
  const [isRunning, setIsRunning] = useState(false)

  async function runAgent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsRunning(true)
    try {
      setResult(await agentApi.respond(message))
    } catch {
      setResult(null)
      setError('Mini Agent could not run. Check the Meeting API.')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <main className="page-shell content-stack page-top">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">No model key required</p>
          <h1>Mini Agent Lab</h1>
          <p>A deterministic local agent that makes pipeline upgrades and regression visible.</p>
        </div>
        <span className="tag success">Local simulation</span>
      </div>

      <div className="operations-grid">
        <section className="panel intake-form-panel" aria-labelledby="agent-input-title">
          <div className="panel-header">
            <div>
              <p className="step-label">Input</p>
              <h2 id="agent-input-title">Ask the agent</h2>
            </div>
          </div>
          <form className="intake-form" onSubmit={runAgent}>
            <label>
              Message
              <textarea
                value={message}
                maxLength={500}
                rows={5}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>
            <button className="primary-button" type="submit" disabled={isRunning || !message.trim()}>
              {isRunning ? 'Running…' : 'Run Mini Agent'}
            </button>
            {error && <p className="service-error" role="alert">{error}</p>}
          </form>
        </section>

        <section className="panel issue-preview" aria-labelledby="agent-output-title">
          <div className="panel-header">
            <div>
              <p className="step-label">Output and trace</p>
              <h2 id="agent-output-title">Deterministic result</h2>
            </div>
            {result && <span className="tag success">Passed</span>}
          </div>
          {result ? (
            <div role="status" className="content-stack">
              <p>{result.answer}</p>
              <dl className="issue-meta">
                <div><dt>Intent</dt><dd><code>{result.intent}</code></dd></div>
                <div><dt>Confidence</dt><dd>{result.confidence.toFixed(2)}</dd></div>
                <div><dt>Runtime</dt><dd><code>{result.runtime_version}</code></dd></div>
                <div><dt>Pipeline</dt><dd><code>{result.pipeline_version}</code></dd></div>
              </dl>
              <pre>{result.stages.join('\n')}</pre>
            </div>
          ) : (
            <div className="preview-placeholder">
              <span aria-hidden="true">→</span>
              <h3>Run a sample request</h3>
              <p>The answer, classified intent, versions, and pipeline stages appear here.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
