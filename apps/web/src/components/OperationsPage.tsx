const weeklyMetrics = [
  { day: 'Mon', score: 91 },
  { day: 'Tue', score: 94 },
  { day: 'Wed', score: 92 },
  { day: 'Thu', score: 96 },
  { day: 'Fri', score: 97 },
  { day: 'Sat', score: 95 },
  { day: 'Sun', score: 98 },
]

export function OperationsPage() {
  return (
    <main className="page-shell content-stack page-top operations-page">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">Cloud Agent control plane</p>
          <h1>Operations overview</h1>
          <p>Security health and conversational quality at a glance.</p>
        </div>
        <span className="last-updated"><i aria-hidden="true" /> Updated just now</span>
      </div>

      <section className="metric-grid" aria-label="Platform health metrics">
        <article className="metric-card quality-card">
          <div className="metric-card-header">
            <span>E2E quality score</span>
            <span className="trend positive">↑ 4.2%</span>
          </div>
          <div className="score-row">
            <strong>97.4</strong><span>/ 100</span>
          </div>
          <div className="progress-track" aria-label="E2E quality score 97.4 out of 100">
            <span style={{ width: '97.4%' }} />
          </div>
          <p>Target 95 · All critical flows passing</p>
        </article>
        <article className="metric-card">
          <div className="metric-card-header">
            <span>Security alerts</span>
            <span className="metric-icon warning" aria-hidden="true">!</span>
          </div>
          <div className="score-row"><strong>2</strong><span>open</span></div>
          <p><b>0 critical</b> · 1 high · 1 medium</p>
          <a href="#security-alerts">Review alert queue →</a>
        </article>
      </section>

      <section className="panel quality-panel" aria-labelledby="weekly-title">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Last 7 days</p>
              <h2 id="weekly-title">Weekly quality</h2>
            </div>
            <span className="trend positive">+3.8 pts</span>
          </div>
          <div className="chart" aria-label="Daily quality scores">
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
            <div><dt>Task completion</dt><dd>98.1%</dd></div>
            <div><dt>Median latency</dt><dd>812 ms</dd></div>
            <div><dt>Tests executed</dt><dd>14,280</dd></div>
          </dl>
      </section>

      <section className="panel" id="security-alerts" aria-labelledby="alerts-title">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Action required</p>
            <h2 id="alerts-title">Security alerts</h2>
          </div>
          <button type="button" className="secondary-button">View all alerts</button>
        </div>
        <div className="alert-table-wrapper">
          <table>
            <thead>
              <tr>
                <th scope="col">Severity</th>
                <th scope="col">Finding</th>
                <th scope="col">Service</th>
                <th scope="col">Detected</th>
                <th scope="col">Owner</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="tag danger">High</span></td>
                <td><strong>Transitive package requires patch</strong><small>CVE-2026-1842</small></td>
                <td>session-gateway</td>
                <td>3h ago</td>
                <td>Platform Core</td>
              </tr>
              <tr>
                <td><span className="tag warning">Medium</span></td>
                <td><strong>Container base image out of policy</strong><small>Runtime policy</small></td>
                <td>voice-worker</td>
                <td>1d ago</td>
                <td>Agent Runtime</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
