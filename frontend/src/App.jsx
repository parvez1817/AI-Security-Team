import { useState } from 'react'
import Header from './components/layout/Header.jsx'
import OfficeCanvas from './components/office/OfficeCanvas.jsx'
import AgentInfoPanel from './components/office/AgentInfoPanel.jsx'
import MissionPanel from './components/dashboard/MissionPanel.jsx'
import ActivityLog from './components/dashboard/ActivityLog.jsx'
import { ApprovalModal, ReportPanel } from './components/dashboard/ApprovalPanel.jsx'
import { useWebSocket } from './hooks/useWebSocket.js'

export default function App() {
  const snap = useWebSocket()
  const [selected, setSelected] = useState(null)
  const [darkTheme, setDarkTheme] = useState(false)
  const [runStarted, setRunStarted] = useState(false)
  const idleMotion = !runStarted && (!snap?.mission || snap.mission.status === 'created')
  return (
    <div className={`app${darkTheme ? ' dark' : ''}`}>
      <Header snap={snap} darkTheme={darkTheme} onToggleTheme={() => setDarkTheme((dark) => !dark)} />
      <main>
        <OfficeCanvas snap={snap} selected={selected} onSelect={setSelected} darkTheme={darkTheme} idleMotion={idleMotion} />
        <aside>
          <MissionPanel snap={snap} onRunStart={() => setRunStarted(true)} />
          {selected && <AgentInfoPanel snap={snap} id={selected} onClose={() => setSelected(null)} />}
          <ReportPanel snap={snap} />
          <ActivityLog snap={snap} />
        </aside>
      </main>
      {snap?.mission?.status === 'waiting_approval' && <ApprovalModal snap={snap} />}
    </div>
  )
}
