const j = async (path, opts = {}) => {
  const r = await fetch('/api/v1' + path, { headers: { 'Content-Type': 'application/json' }, ...opts })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || r.statusText)
  return r.json()
}
export const api = {
  sample: () => j('/samples/default'),
  create: (filename, code) => j('/missions', { method: 'POST', body: JSON.stringify({ filename, code }) }),
  run: (id) => j(`/missions/${id}/run`, { method: 'POST' }),
  decide: (approved) => j('/approvals', { method: 'POST', body: JSON.stringify({ approved }) }),
}
