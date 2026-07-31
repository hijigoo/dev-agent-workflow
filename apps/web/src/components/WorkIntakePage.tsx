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
          ? '접수 서비스가 이 외부 키에 대한 기존 작업 항목을 반환했습니다.'
          : '접수 서비스가 작업 항목을 생성했습니다.',
      )
    } catch {
      setResult(null)
      setError('작업 항목을 생성하지 못했습니다. Work Intake API를 확인한 뒤 다시 시도하세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page-shell content-stack page-top">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">에이전트 지원 기획</p>
          <h1>작업 접수</h1>
          <p>운영 신호를 실행 가능한 작업 항목과 GitHub 이슈 초안으로 전환하세요.</p>
        </div>
        <span className="tag neutral">5개 가이드 시나리오</span>
      </div>
      <div className="intake-layout">
        <section className="panel intake-form-panel" aria-labelledby="intake-form-title">
          <div className="panel-header">
            <div>
              <p className="step-label">2단계 중 1단계</p>
              <h2 id="intake-form-title">작업 설명</h2>
            </div>
          </div>
          <form className="intake-form" onSubmit={handleSubmit}>
            <fieldset>
              <legend>시나리오</legend>
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
              <span>대상</span>
              <div className="segmented-control">
                <button
                  type="button"
                  className={destination === 'local' ? 'selected' : ''}
                  aria-pressed={destination === 'local'}
                  onClick={() => setDestination('local')}
                >
                  로컬 백로그
                </button>
                <button
                  type="button"
                  className={destination === 'jira' ? 'selected' : ''}
                  aria-pressed={destination === 'jira'}
                  onClick={() => setDestination('jira')}
                >
                  Jira 유사 큐
                </button>
              </div>
            </div>
            <label>
              작업 항목 제목
              <input key={selectedScenario.id} name="title" required defaultValue={selectedScenario.defaultTitle} />
            </label>
            <label>
              설명
              <textarea
                key={`${selectedScenario.id}-description`}
                name="description"
                required
                rows={5}
                defaultValue={selectedScenario.description}
              />
            </label>
            <label>
              우선순위
              <select name="priority" defaultValue="P2">
                <option value="P1">P1 · 긴급</option>
                <option value="P2">P2 · 보통</option>
                <option value="P3">P3 · 계획</option>
              </select>
            </label>
            <div className="suggested-labels" aria-label="추천 라벨">
              <span>추천 라벨</span>
              {selectedScenario.defaultLabels.map((label) => (
                <code key={label}>{label}</code>
              ))}
            </div>
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? '생성 중…' : '작업 항목 생성'}
            </button>
            {error && <p className="service-error" role="alert">{error}</p>}
          </form>
        </section>

        <aside className="panel issue-preview" aria-labelledby="preview-title">
          <div className="panel-header">
            <div>
              <p className="step-label">2단계 중 2단계</p>
              <h2 id="preview-title">GitHub 이슈 미리보기</h2>
            </div>
            {result && <span className="tag success">준비됨</span>}
          </div>
          {result ? (
            <>
              <p className="notice" role="status">{notice}</p>
              <div className="issue-window">
                <div className="issue-window-header">
                  <span aria-hidden="true">이슈</span>
                  <code>{result.work_item.github_issue_number ?? result.work_item.id}</code>
                </div>
                <h3>{result.work_item.title}</h3>
                <pre>
                  {result.work_item.preview_body?.body ?? result.work_item.description}
                </pre>
              </div>
              <dl className="issue-meta">
                <div><dt>외부 키</dt><dd><code>{result.work_item.external_key}</code></dd></div>
                <div><dt>전달</dt><dd>{result.work_item.delivery_mode} · {result.work_item.delivery_status}</dd></div>
                <div>
                  <dt>이슈 URL</dt>
                  <dd>
                    {result.work_item.github_issue_url ? (
                      <a href={result.work_item.github_issue_url}>{result.work_item.github_issue_url}</a>
                    ) : (
                      '미리보기 전용 — 전달된 이슈 URL이 없습니다'
                    )}
                  </dd>
                </div>
              </dl>
              {result.work_item.github_issue_url && (
                <a className="primary-button centered" href={result.work_item.github_issue_url}>
                  생성된 이슈 열기
                </a>
              )}
            </>
          ) : (
            <div className="preview-placeholder">
              <span aria-hidden="true">#</span>
              <h3>이슈 초안이 여기에 표시됩니다</h3>
              <p>시나리오를 선택하고 작업 항목을 생성해 제목, 본문, URL을 확인하세요.</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
