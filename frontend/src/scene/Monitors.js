import * as THREE from 'three'

export function makeScreen(w, h) {
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return { canvas, ctx: canvas.getContext('2d'), tex, mat: new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) }
}
const TONE = { ok: '#5fd38d', warn: '#f2c94c', bad: '#ff6b6b', info: '#8ab4ff', dim: '#8b95a1' }
const STATE = { idle: '#a8a29a', working: '#2f80ed', handoff: '#8a63d2', rejected: '#e5484d', waiting: '#f0b429', done: '#2fa564' }

const CODE_COLORS = ['#5fd38d', '#f2c94c', '#8ab4ff', '#ff8f6b', '#d28cff', '#e8edf2']
function rng(seed) { let t = seed >>> 0; return () => ((t = (t * 1664525 + 1013904223) >>> 0) / 4294967296) }
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r) }

// Decorative "code editor" lines so an idle monitor still looks alive; seeded per agent so they stay stable.
function fauxCode(g, seed, x, y, w, rows, lineH) {
  const r = rng(seed)
  for (let i = 0; i < rows; i++) {
    let cx = x + Math.floor(r() * 3) * 22
    const parts = 2 + Math.floor(r() * 4)
    for (let k = 0; k < parts; k++) {
      const len = 24 + Math.floor(r() * 90)
      if (cx + len > x + w) break
      g.fillStyle = CODE_COLORS[Math.floor(r() * CODE_COLORS.length)]; g.globalAlpha = 0.85
      roundRect(g, cx, y + i * lineH, len, 9, 4); g.fill(); cx += len + 10
    }
  }
  g.globalAlpha = 1
}

export function drawAgentScreen(sc, agent, st, lines = []) {
  const g = sc.ctx, { width: W, height: H } = sc.canvas
  g.fillStyle = '#0b1220'; g.fillRect(0, 0, W, H)
  const bar = g.createLinearGradient(0, 0, W, 0); bar.addColorStop(0, agent.color); bar.addColorStop(1, '#1b2740')
  g.fillStyle = bar; g.fillRect(0, 0, W, 52)
  g.fillStyle = '#fff'; g.font = 'bold 26px system-ui'; g.fillText(agent.name, 16, 35)
  const state = st?.state || 'idle'
  g.fillStyle = STATE[state]; g.beginPath(); g.arc(W - 30, 26, 10, 0, 7); g.fill()
  g.font = '19px ui-monospace, monospace'
  if (!lines.length) {
    fauxCode(g, agent.id.length * 7919 + agent.id.charCodeAt(0) * 31, 18, 78, W - 36, 12, 25)
    g.fillStyle = 'rgba(11,18,32,.82)'; g.fillRect(0, H - 54, W, 54)
    g.fillStyle = TONE.dim; g.fillText('Waiting for a mission…', 16, H - 20)
  }
  lines.slice(0, 11).forEach((l, i) => { g.fillStyle = TONE[l.k] || '#e8edf2'; g.fillText(l.t.slice(0, 50), 16, 90 + i * 29) })
  sc.tex.needsUpdate = true
}

const HEALTH = { idle: ['Standby', '#8b95a1'], running: ['Healthy', '#2fd07a'], waiting_approval: ['Needs approval', '#f0b429'],
  completed: ['Healthy', '#2fd07a'], rejected: ['Rejected', '#ff6b6b'], failed: ['Failed', '#ff6b6b'], created: ['Ready', '#8ab4ff'] }

export function drawTv(sc, snap) {
  const g = sc.ctx, { width: W, height: H } = sc.canvas
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0e1626'); bg.addColorStop(1, '#0a101b')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  const m = snap?.mission, b = snap?.board, c = b?.counts || {}
  g.fillStyle = '#fff'; g.font = 'bold 44px system-ui'; g.fillText('Mission control', 40, 72)
  g.fillStyle = '#8b95a1'; g.font = '24px system-ui'; g.fillText(m ? `${m.filename}  ·  ${m.status.replace('_', ' ')}` : 'No mission yet', 40, 108)
  const [healthLabel, healthColor] = HEALTH[m?.status || 'idle'] || HEALTH.idle
  g.fillStyle = '#8b95a1'; g.font = '22px system-ui'; g.fillText('System health', 40, 156)
  g.fillStyle = healthColor; g.beginPath(); g.arc(52, 190, 10, 0, 7); g.fill()
  g.fillStyle = '#fff'; g.font = 'bold 28px system-ui'; g.fillText(healthLabel, 72, 200)
  const t = m?.started ? Math.round(((m.ended || Date.now() / 1000) - m.started)) : 0
  const stats = [['Runtime', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`], ['Findings', c.findings || 0], ['Critical', c.critical || 0], ['Handoffs', c.handoffs || 0], ['Rejects', c.rejects || 0]]
  stats.forEach(([k, v], i) => {
    const x = 330 + i * 134
    g.fillStyle = '#16213a'; roundRect(g, x, 134, 122, 92, 10); g.fill()
    g.fillStyle = '#8b95a1'; g.font = '19px system-ui'; g.fillText(k, x + 14, 164)
    g.fillStyle = k === 'Critical' && v ? '#ff6b6b' : '#fff'; g.font = 'bold 40px system-ui'; g.fillText(String(v), x + 14, 211)
  })
  g.fillStyle = '#e8edf2'; g.font = 'bold 26px system-ui'; g.fillText('Activity overview', 40, 284)
  const sev = [['Critical', 'critical', '#ff4d7d'], ['High', 'high', '#ff9f43'], ['Medium', 'medium', '#f2c94c'], ['Low', 'low', '#5fd38d']]
  const total = Math.max(1, ...sev.map(([, k]) => c[k] || 0))
  const sum = sev.reduce((n, [, k]) => n + (c[k] || 0), 0)
  sev.forEach(([label, key, col], i) => {
    const y = 308 + i * 48, n = c[key] || 0, w = Math.max(n ? 12 : 0, (n / total) * 560)
    g.fillStyle = '#e8edf2'; g.font = '22px system-ui'; g.fillText(label, 40, y + 25)
    g.fillStyle = '#16213a'; roundRect(g, 150, y, 600, 32, 16); g.fill()
    if (w) { g.fillStyle = col; roundRect(g, 150, y, w, 32, 16); g.fill() }
    g.fillStyle = '#e8edf2'; g.fillText(sum ? `${Math.round((n / sum) * 100)}%  (${n})` : '0', 776, y + 25)
  })
  const wait = m?.status === 'waiting_approval'
  g.fillStyle = wait ? '#f0b429' : '#16213a'; roundRect(g, 40, 520, W - 80, 56, 14); g.fill()
  g.fillStyle = wait ? '#10171f' : '#8b95a1'; g.font = 'bold 26px system-ui'
  g.fillText(wait ? 'Waiting for your approval' : `Stage: ${b?.stage || 'idle'}`, 62, 557)
  sc.tex.needsUpdate = true
}
