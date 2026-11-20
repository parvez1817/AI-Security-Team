import { useEffect, useState } from 'react'
import { connect } from '../services/websocket.js'

export function useWebSocket() {
  const [snap, setSnap] = useState(null)
  useEffect(() => connect(setSnap), [])
  return snap
}
