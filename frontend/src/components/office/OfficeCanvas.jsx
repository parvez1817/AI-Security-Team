import { useEffect, useRef } from 'react'
import { SceneManager } from '../../scene/SceneManager.js'

export default function OfficeCanvas({ snap, selected, onSelect, darkTheme, idleMotion }) {
  const ref = useRef(), sm = useRef()
  useEffect(() => { const s = new SceneManager(ref.current, { onSelect }); sm.current = s; return () => s.dispose() }, [])
  useEffect(() => { snap && sm.current?.setSnapshot(snap) }, [snap])
  useEffect(() => { selected ? sm.current?.focus(selected) : sm.current?.resetView() }, [selected])
  useEffect(() => { sm.current?.setTheme(darkTheme) }, [darkTheme])
  useEffect(() => { sm.current?.setIdleMotion(idleMotion) }, [idleMotion])
  return (
    <section className="office">
      <div ref={ref} className="canvas" />
      <p className="hint">Drag to orbit, scroll to zoom, click a person to see their monitor</p>
    </section>
  )
}
