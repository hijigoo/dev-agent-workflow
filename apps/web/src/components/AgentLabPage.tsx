import { useState } from 'react'
import { agentApi } from '../api'
import type { AgentResponse } from '../types'

export function AgentLabPage() {
  const [message, setMessage] = useState('회의실 예약은 어떻게 하나요?')
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
      setError('미니 에이전트를 실행하지 못했습니다. 회의 API를 확인하세요.')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <main className="page-shell content-stack page-top">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">모델 키 없이 실행</p>
          <h1>미니 에이전트 실험실</h1>
          <p>결정론적 로컬 에이전트로 파이프라인 개선과 회귀를 확인할 수 있습니다.</p>
        </div>
        <span className="tag success">로컬 시뮬레이션</span>
      </div>

      <div className="operations-grid">
        <section className="panel intake-form-panel" aria-labelledby="agent-input-title">
          <div className="panel-header">
            <div>
              <p className="step-label">입력</p>
              <h2 id="agent-input-title">에이전트에게 질문하기</h2>
            </div>
          </div>
          <form className="intake-form" onSubmit={runAgent}>
            <label>
              메시지
              <textarea
                value={message}
                maxLength={500}
                rows={5}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>
            <button className="primary-button" type="submit" disabled={isRunning || !message.trim()}>
              {isRunning ? '실행 중…' : '미니 에이전트 실행'}
            </button>
            {error && <p className="service-error" role="alert">{error}</p>}
          </form>
        </section>

        <section className="panel issue-preview" aria-labelledby="agent-output-title">
          <div className="panel-header">
            <div>
              <p className="step-label">출력 및 추적</p>
              <h2 id="agent-output-title">결정론적 결과</h2>
            </div>
            {result && <span className="tag success">통과</span>}
          </div>
          {result ? (
            <div role="status" className="content-stack">
              <p>{result.answer}</p>
              <dl className="issue-meta">
                <div><dt>의도</dt><dd><code>{result.intent}</code></dd></div>
                <div><dt>신뢰도</dt><dd>{result.confidence.toFixed(2)}</dd></div>
                <div><dt>런타임</dt><dd><code>{result.runtime_version}</code></dd></div>
                <div><dt>파이프라인</dt><dd><code>{result.pipeline_version}</code></dd></div>
              </dl>
              <pre>{result.stages.join('\n')}</pre>
            </div>
          ) : (
            <div className="preview-placeholder">
              <span aria-hidden="true">→</span>
              <h3>샘플 요청 실행</h3>
              <p>답변, 분류된 의도, 버전, 파이프라인 단계가 여기에 표시됩니다.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
