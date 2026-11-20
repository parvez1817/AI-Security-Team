export function connect(onMessage) {
  let ws, closed = false
  const open = () => {
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/dashboard`)
    ws.onmessage = (e) => onMessage(JSON.parse(e.data))
    ws.onclose = () => !closed && setTimeout(open, 1500)
  }
  open()
  return () => { closed = true; ws.close() }
}
