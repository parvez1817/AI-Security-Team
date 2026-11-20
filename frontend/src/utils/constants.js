export const AGENTS = [
  { id: 'manager', name: 'Manager / Orchestrator', short: 'Manager', color: '#5b7cfa', role: 'Routes work, keeps state, runs the final verification loop' },
  { id: 'risk', name: 'Risk Assessor', short: 'Risk', color: '#e8893a', role: 'Threat-models endpoints, auth gaps and IDOR' },
  { id: 'sast', name: 'SAST Code Reviewer', short: 'SAST', color: '#d4577a', role: 'Static analysis: injection, deserialization, XSS' },
  { id: 'pentest', name: 'Pentester & DAST', short: 'Pentest', color: '#8a63d2', role: 'Attack probes and dependency (CVE) audit' },
  { id: 'implementer', name: 'Security Implementer', short: 'Implementer', color: '#2f9e8f', role: 'Writes hardened code with auth, RBAC, validation to ./sandbox/' },
  { id: 'crypto', name: 'Crypto & Data Security', short: 'Crypto', color: '#c9a227', role: 'bcrypt hashing, secrets, token protection' },
]
export const STATE_COLORS = { idle: '#a8a29a', working: '#2f80ed', handoff: '#8a63d2', rejected: '#e5484d', waiting: '#f0b429', done: '#2fa564' }
export const STATUS_LABEL = {
  created: ['Ready', 'idle'], running: ['Working', 'working'], waiting_approval: ['Needs you', 'waiting'],
  rejected: ['Rejected', 'rejected'], completed: ['Done', 'done'], failed: ['Failed', 'rejected'],
}
