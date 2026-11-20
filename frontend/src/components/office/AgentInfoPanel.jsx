import { AGENTS, STATE_COLORS } from '../../utils/constants.js'

export default function AgentInfoPanel({ snap, id, onClose }) {
  const a = AGENTS.find((x) => x.id === id), st = snap?.agents?.[id]
  return (
    <div className="card">
      <div className="row"><h2>{a.name}</h2><button className="link" onClick={onClose}>Reset view</button></div>
      <p className="muted">{a.role}</p>
      <p><i className="dot" style={{ background: STATE_COLORS[st?.state || 'idle'] }} /> {st?.state || 'idle'}: {st?.message}</p>
    </div>
  )
}
