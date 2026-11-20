import { AGENTS, STATE_COLORS } from '../../utils/constants.js'

export default function ActivityLog({ snap }) {
  const ev = [...(snap?.events || [])].reverse()
  return (
    <div className="card">
      <h2>Activity</h2>
      {!ev.length && <p className="muted">Events appear here once agents start.</p>}
      <ul className="log">
        {ev.map((e) => (
          <li key={e.id}>
            <i className="dot" style={{ background: STATE_COLORS[e.state] }} />
            <span className="muted">{e.time}</span> <b>{AGENTS.find((a) => a.id === e.agent)?.short}</b> {e.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
