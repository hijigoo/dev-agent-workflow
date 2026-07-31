const weeklyMetrics = [
  { day: '월', score: 91 },
  { day: '화', score: 94 },
  { day: '수', score: 92 },
  { day: '목', score: 96 },
  { day: '금', score: 97 },
  { day: '토', score: 95 },
  { day: '일', score: 98 },
]

export function OperationsPage() {
  return (
    <main className="page-shell content-stack page-top operations-page">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">클라우드 에이전트 제어 플레인</p>
          <h1>운영 현황</h1>
          <p>보안 상태와 대화 품질을 한눈에 확인하세요.</p>
        </div>
        <span className="last-updated"><i aria-hidden="true" /> 방금 업데이트됨</span>
      </div>

      <section className="metric-grid" aria-label="플랫폼 상태 지표">
        <article className="metric-card quality-card">
          <div className="metric-card-header">
            <span>E2E 품질 점수</span>
            <span className="trend positive">↑ 4.2%</span>
          </div>
          <div className="score-row">
            <strong>97.4</strong><span>/ 100</span>
          </div>
          <div className="progress-track" aria-label="E2E 품질 점수 100점 만점에 97.4점">
            <span style={{ width: '97.4%' }} />
          </div>
          <p>목표 95 · 모든 핵심 플로우 통과</p>
        </article>
        <article className="metric-card">
          <div className="metric-card-header">
            <span>보안 알림</span>
            <span className="metric-icon warning" aria-hidden="true">!</span>
          </div>
          <div className="score-row"><strong>2</strong><span>열림</span></div>
          <p><b>치명적 0건</b> · 높음 1건 · 보통 1건</p>
          <a href="#security-alerts">알림 대기열 보기 →</a>
        </article>
      </section>

      <section className="panel quality-panel" aria-labelledby="weekly-title">
          <div className="panel-header">
            <div>
              <p className="eyebrow">최근 7일</p>
              <h2 id="weekly-title">주간 품질</h2>
            </div>
            <span className="trend positive">+3.8점</span>
          </div>
          <div className="chart" aria-label="일별 품질 점수">
            {weeklyMetrics.map((metric) => (
              <div className="chart-column" key={metric.day}>
                <span className="chart-value">{metric.score}</span>
                <div className="bar-track">
                  <span style={{ height: `${metric.score}%` }} />
                </div>
                <small>{metric.day}</small>
              </div>
            ))}
          </div>
          <dl className="quality-details">
            <div><dt>작업 완료율</dt><dd>98.1%</dd></div>
            <div><dt>중앙값 지연 시간</dt><dd>812 ms</dd></div>
            <div><dt>실행된 테스트</dt><dd>14,280</dd></div>
          </dl>
      </section>

      <section className="panel" id="security-alerts" aria-labelledby="alerts-title">
        <div className="panel-header">
          <div>
            <p className="eyebrow">조치 필요</p>
            <h2 id="alerts-title">보안 알림</h2>
          </div>
          <button type="button" className="secondary-button">모든 알림 보기</button>
        </div>
        <div className="alert-table-wrapper">
          <table>
            <thead>
              <tr>
                <th scope="col">심각도</th>
                <th scope="col">항목</th>
                <th scope="col">서비스</th>
                <th scope="col">탐지 시각</th>
                <th scope="col">담당 팀</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="tag danger">높음</span></td>
                <td><strong>전이 의존 패키지 패치 필요</strong><small>CVE-2026-1842</small></td>
                <td>session-gateway</td>
                <td>3시간 전</td>
                <td>플랫폼 코어</td>
              </tr>
              <tr>
                <td><span className="tag warning">보통</span></td>
                <td><strong>컨테이너 베이스 이미지 정책 위반</strong><small>런타임 정책</small></td>
                <td>voice-worker</td>
                <td>1일 전</td>
                <td>에이전트 런타임</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
