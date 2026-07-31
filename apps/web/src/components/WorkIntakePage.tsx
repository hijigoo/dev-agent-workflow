import { useMemo, useState } from 'react'
import { workIntakeApi } from '../api'
import { workScenarios } from '../data'
import type { WorkDestination, WorkItemInput, WorkItemResponse } from '../types'

export function WorkIntakePage() {
  const [scenarioId, setScenarioId] = useState(workScenarios[0].id)
  const [destination, setDestination] = useState<WorkDestination>('local')
  const [result, setResult] = useState<WorkItemResponse | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const selectedScenario = useMemo(
    () => workScenarios.find((item) => item.id === scenarioId) ?? workScenarios[0],
    [scenarioId],
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const priority = String(form.get('priority')).toLowerCase()
    const input: WorkItemInput = {
      external_key: selectedScenario.externalKey,
      title: String(form.get('title')),
      description: String(form.get('description')),
      source: destination,
      status: 'open',
      labels: [...selectedScenario.defaultLabels, `priority:${priority}`],
    }

    setIsSubmitting(true)
    setNotice('')
    setError('')
    try {
      const created = await workIntakeApi.create(input)
      setResult(created)
      setNotice(
        created.idempotent_replay
          ? 'The intake service returned the existing work item for this external key.'
          : 'Work item created by the intake service.',
      )
    } catch {
      setResult(null)
      setError('Work item could not be created. Check the Work Intake API and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page-shell content-stack page-top">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">Agent-assisted planning</p>
          <h1>Work Intake</h1>
          <p>Turn an operational signal into an actionable work item and GitHub Issue draft.</p>
        </div>
        <span className="tag neutral">5 guided scenarios</span>
      </div>
      <div className="intake-layout">
        <section className="panel intake-form-panel" aria-labelledby="intake-form-title">
          <div className="panel-header">
            <div>
              <p className="step-label">Step 1 of 2</p>
              <h2 id="intake-form-title">Describe the work</h2>
            </div>
          </div>
          <form className="intake-form" onSubmit={handleSubmit}>
            <fieldset>
              <legend>Scenario</legend>
              <div className="scenario-grid">
                {workScenarios.map((scenario) => (
                  <label
                    key={scenario.id}
                    className={scenarioId === scenario.id ? 'scenario-card selected' : 'scenario-card'}
                  >
                    <input
                      type="radio"
                      name="scenario"
                      value={scenario.id}
                      checked={scenarioId === scenario.id}
                      onChange={() => {
                        setScenarioId(scenario.id)
                        setResult(null)
                        setError('')
                      }}
                    />
                    <span>
                      <strong>{scenario.label}</strong>
                      <small>{scenario.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="destination-field">
              <span>Destination</span>
              <div className="segmented-control">
                <button
                  type="button"
                  className={destination === 'local' ? 'selected' : ''}
                  aria-pressed={destination === 'local'}
                  onClick={() => setDestination('local')}
                >
                  Local backlog
                </button>
                <button
                  type="button"
                  className={destination === 'jira' ? 'selected' : ''}
                  aria-pressed={destination === 'jira'}
                  onClick={() => setDestination('jira')}
                >
                  Jira-like queue
                </button>
              </div>
            </div>
            <label>
              Work item title
              <input key={selectedScenario.id} name="title" required defaultValue={selectedScenario.defaultTitle} />
            </label>
            <label>
              Description
              <textarea
                key={`${selectedScenario.id}-description`}
                name="description"
                required
                rows={5}
                defaultValue={selectedScenario.description}
              />
            </label>
            <label>
              Priority
              <select name="priority" defaultValue="P2">
                <option value="P1">P1 · Urgent</option>
                <option value="P2">P2 · Normal</option>
                <option value="P3">P3 · Planned</option>
              </select>
            </label>
            <div className="suggested-labels" aria-label="Suggested labels">
              <span>Suggested labels</span>
              {selectedScenario.defaultLabels.map((label) => (
                <code key={label}>{label}</code>
              ))}
            </div>
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Generating…' : 'Generate work item'}
            </button>
            {error && <p className="service-error" role="alert">{error}</p>}
          </form>
        </section>

        <aside className="panel issue-preview" aria-labelledby="preview-title">
          <div className="panel-header">
            <div>
              <p className="step-label">Step 2 of 2</p>
              <h2 id="preview-title">GitHub Issue preview</h2>
            </div>
            {result && <span className="tag success">Ready</span>}
          </div>
          {result ? (
            <>
              <p className="notice" role="status">{notice}</p>
              <div className="issue-window">
                <div className="issue-window-header">
                  <span aria-hidden="true">Issue</span>
                  <code>{result.work_item.github_issue_number ?? result.work_item.id}</code>
                </div>
                <h3>{result.work_item.title}</h3>
                <pre>
                  {result.work_item.preview_body?.body ?? result.work_item.description}
                </pre>
              </div>
              <dl className="issue-meta">
                <div><dt>External key</dt><dd><code>{result.work_item.external_key}</code></dd></div>
                <div><dt>Delivery</dt><dd>{result.work_item.delivery_mode} · {result.work_item.delivery_status}</dd></div>
                <div>
                  <dt>Issue URL</dt>
                  <dd>
                    {result.work_item.github_issue_url ? (
                      <a href={result.work_item.github_issue_url}>{result.work_item.github_issue_url}</a>
                    ) : (
                      'Preview only — no issue URL delivered'
                    )}
                  </dd>
                </div>
              </dl>
              {result.work_item.github_issue_url && (
                <a className="primary-button centered" href={result.work_item.github_issue_url}>
                  Open generated issue
                </a>
              )}
            </>
          ) : (
            <div className="preview-placeholder">
              <span aria-hidden="true">#</span>
              <h3>Your issue draft will appear here</h3>
              <p>Choose a scenario and generate a work item to review the title, body, and URL.</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
