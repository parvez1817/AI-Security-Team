import { useState } from 'react'
import { api } from '../../services/api.js'

export default function MissionPanel({ snap, onRunStart }) {
  const [filename, setFilename] = useState('app.py'), [code, setCode] = useState(''), [err, setErr] = useState('')
  const busy = ['running', 'waiting_approval'].includes(snap?.mission?.status)
  const loadSample = () => api.sample().then((s) => { setFilename(s.filename); setCode(s.code) }).catch((e) => setErr(e.message))
  const onFile = async (e) => { const f = e.target.files[0]; if (f) { setFilename(f.name); setCode(await f.text()) } }
  const run = async () => {
    setErr('')
    onRunStart?.()
    try { const m = await api.create(filename, code); await api.run(m.id) } catch (e) { setErr(e.message) }
  }
  return (
    <div className="card">
      <h2>1. Give the agents your source code</h2>
      <div className="row">
        <input value={filename} onChange={(e) => setFilename(e.target.value)} aria-label="File name" />
        <label className="btn ghost">Upload file<input type="file" hidden onChange={onFile} /></label>
        <button className="btn ghost" onClick={loadSample}>Load sample</button>
      </div>
      <textarea value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste backend code here, upload a file, or load the sample weak app" spellCheck={false} />
      <button className="btn primary" disabled={busy || !code.trim()} onClick={run}>{busy ? 'Agents are working…' : 'Run security agents'}</button>
      {err && <p className="error">{err}</p>}
      <p className="muted small">Your original file is never modified. Nothing is written until you approve.</p>
    </div>
  )
}
