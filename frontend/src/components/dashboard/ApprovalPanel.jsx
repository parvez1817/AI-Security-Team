import { api } from '../../services/api.js'

const Findings = ({ list }) => (
  <table className="table">
    <thead><tr><th>Severity</th><th>CWE</th><th>Line</th><th>Issue</th></tr></thead>
    <tbody>{list.map((f, i) => <tr key={i}><td><span className={`sev ${f.severity}`}>{f.severity}</span></td><td>{f.cwe}</td><td>{f.line}</td><td>{f.title}</td></tr>)}</tbody>
  </table>
)

export function ApprovalModal({ snap }) {
  const { board: b, mission: m, llm_ready } = snap
  return (
    <div className="overlay">
      <div className="modal" role="dialog" aria-label="Approval checkpoint">
        <h2>Approve writing to ./sandbox/?</h2>
        <p>The agents found <b>{b.counts.findings} issues</b> ({b.counts.critical} critical, {b.counts.high} high) in <code>{m.filename}</code>. If you approve, they will write hardened code into a new <code>sandbox</code> folder.</p>
        <h3>Planned changes</h3>
        <ul>{b.plan.map((p, i) => <li key={i}>{p}</li>)}</ul>
        {!llm_ready && <p className="error">XAI_API_KEY is not set on the backend, so approving will fail. Add it to .env and restart, or reject to see the report only.</p>}
        <div className="row end">
          <button className="btn ghost" onClick={() => api.decide(false)}>Reject, show report only</button>
          <button className="btn primary" onClick={() => api.decide(true)}>Approve and write to sandbox</button>
        </div>
      </div>
    </div>
  )
}

export function ReportPanel({ snap }) {
  const m = snap?.mission, b = snap?.board
  if (!m || !['rejected', 'completed', 'failed'].includes(m.status)) return null
  const o = b.overview
  return (
    <div className="card">
      <h2>{m.status === 'rejected' ? 'Overview (nothing was written)' : m.status === 'failed' ? 'Pipeline failed' : 'Sandbox result'}</h2>
      {m.error && <p className="error">{m.error}</p>}
      <p className="muted">{o.lines} lines, {o.functions} functions, {o.routes} routes. Third-party imports: {(o.third_party || []).join(', ') || 'none'}</p>
      {b.threat_model && <pre className="pre wrap">{b.threat_model}</pre>}
      {m.status === 'completed' && (
        <>
          <p className={b.verification.passed ? 'ok' : 'error'}>
            Verification {b.verification.passed ? 'passed' : 'found remaining issues'} after {b.verification.attempts} round(s): syntax {b.verification.syntax_ok ? 'valid' : 'invalid'}, {b.verification.remaining.length} critical/high left.
          </p>
          <p>Written to <code>sandbox/</code>: {b.sandbox_files.join(', ')}</p>
          <ul>{b.fixes.map((f, i) => <li key={i}>{f}</li>)}</ul>
          <details><summary>Diff (original to sandbox)</summary><pre className="pre">{b.diff}</pre></details>
        </>
      )}
      <h3>Findings in the original code</h3>
      <Findings list={b.findings} />
      {b.probes.length > 0 && <details><summary>Planned attack probes</summary><pre className="pre">{b.probes.join('\n')}</pre></details>}
    </div>
  )
}
