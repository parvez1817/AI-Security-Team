import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { AGENTS } from '../utils/constants.js'
import { Person } from './Characters.js'
import { drawAgentScreen, drawTv } from './Monitors.js'
import { buildOffice, MONITOR_Y, OFFICE_WIDTH, STATIONS } from './Office.js'

const HOME_TARGET = new THREE.Vector3(0, 2.1, 0)
const DAY_BACKGROUND = new THREE.Color(0xffffff)
const DAY_HEMI_INTENSITY = 1.25, DAY_SUN_INTENSITY = 1.75
const NIGHT_BACKGROUND = new THREE.Color(0x121a27)
const DAY_HEMISPHERE = new THREE.Color(0xf4f7ff)
const NIGHT_HEMISPHERE = new THREE.Color(0x9eabc2)
const DAY_GROUND = new THREE.Color(0xcfd4e2)
const NIGHT_GROUND = new THREE.Color(0x363846)
const DAY_SUN = new THREE.Color(0xfff1dc)
const NIGHT_SUN = new THREE.Color(0x9eafd0)
const DAY_WINDOW = new THREE.Color(0xeaf6ff)
const NIGHT_WINDOW = new THREE.Color(0x17243a)
const DAY_ACCENT = new THREE.Color(0x2f7bff)
const NIGHT_ACCENT = new THREE.Color(0x157cff)
const HALO_OPACITY = [[0.2, 0.34], [0.09, 0.18]]
const WORLD_UP = new THREE.Vector3(0, 1, 0)

export class SceneManager {
  constructor(container, { onSelect }) {
    this.el = container; this.onSelect = onSelect; this.snap = null; this.lastEvent = 0; this.primed = false; this.tween = null
    this.idleMotion = false; this.idleAmplitude = 0; this.idleBaseAzimuth = 0; this.idleResumeAt = 0; this.userInteracting = false; this.idleNeedsRebase = false
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true }))
    r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap
    r.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(r.domElement)
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0xffffff)
    // image-based reflections give the glossy floor, desks and glass their soft sheen
    const pmrem = new THREE.PMREMGenerator(r); this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.2; pmrem.dispose()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
    this.homePos = new THREE.Vector3(4, 25, 34)
    this.camera.position.copy(this.homePos); this.camera.lookAt(HOME_TARGET)
    const c = (this.controls = new OrbitControls(this.camera, r.domElement))
    Object.assign(c, { enableDamping: true, target: HOME_TARGET.clone(), minZoom: 0.7, maxZoom: 4, maxPolarAngle: 1.4, minAzimuthAngle: 0.05, maxAzimuthAngle: 1.5 })
    this._controlStart = () => { this.userInteracting = true; this.tween = null }
    this._controlEnd = () => {
      this.userInteracting = false
      this.idleNeedsRebase = true
      this.idleResumeAt = performance.now() + 700
    }
    c.addEventListener('start', this._controlStart); c.addEventListener('end', this._controlEnd)
    this.office = buildOffice(this.scene)
    this.themeProgress = 0; this.themeTarget = 0
    AGENTS.forEach((a, i) => drawAgentScreen(this.office.screens[i], a, null, [])); drawTv(this.office.tv, null)
    this.people = AGENTS.map((a, i) => { const p = new Person(a, STATIONS[i]); this.scene.add(p.root); return p })
    this.resize(); this._resize = () => this.resize(); addEventListener('resize', this._resize)
    r.domElement.addEventListener('pointerdown', (e) => (this.down = [e.clientX, e.clientY]))
    r.domElement.addEventListener('pointerup', (e) => { if (this.down && Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) < 5) this.pick(e) })
    this.clock = new THREE.Clock(); this.tvTimer = setInterval(() => this.snap && drawTv(this.office.tv, this.snap), 1000)
    this.loop = this.loop.bind(this); this.raf = requestAnimationFrame(this.loop)
  }

  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight || 1, a = w / h
    const half = Math.max(5.7, OFFICE_WIDTH * 0.55 / a)
    Object.assign(this.camera, { left: -half * a, right: half * a, top: half, bottom: -half }); this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  pick(e) {
    const rc = new THREE.Raycaster(), b = this.renderer.domElement.getBoundingClientRect()
    rc.setFromCamera(new THREE.Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1), this.camera)
    for (const hit of rc.intersectObjects(this.scene.children, true)) {
      for (let o = hit.object; o; o = o.parent) {
        if (o.userData.agentId !== undefined) { const id = typeof o.userData.agentId === 'number' ? AGENTS[o.userData.agentId].id : o.userData.agentId; return this.onSelect(id) }
      }
    }
  }

  focus(id) {
    const st = STATIONS[AGENTS.findIndex((a) => a.id === id)]
    this.tween = { target: new THREE.Vector3(st.x, MONITOR_Y, st.z - 0.25), zoom: 2.4 }
  }
  resetView() { this.tween = { target: HOME_TARGET.clone(), zoom: 1 } }
  setIdleMotion(enabled) {
    if (this.idleMotion === enabled) return
    this.idleMotion = enabled
    if (!enabled) return
    const azimuth = this.controls.getAzimuthalAngle()
    this.idleAmplitude = Math.min(0.55, Math.max(0, this.controls.maxAzimuthAngle - azimuth - 0.02))
    this.idleBaseAzimuth = azimuth - this.idleOffset(this.clock.elapsedTime)
    this.idleNeedsRebase = false
  }
  idleOffset(time) { return this.idleAmplitude * (1 - Math.cos(time * 0.12)) / 2 }
  setTheme(dark) { this.themeTarget = dark ? 1 : 0 }

  updateTheme(dt) {
    this.themeProgress += (this.themeTarget - this.themeProgress) * Math.min(1, dt * 2.5)
    const amount = this.themeProgress
    const { hemisphere, sun, nightLights, accentLights, accentMaterial, haloMaterials, warmLights, warmMaterials, glowSprites, windowMaterial, surfaces } = this.office.theme
    hemisphere.color.lerpColors(DAY_HEMISPHERE, NIGHT_HEMISPHERE, amount)
    hemisphere.groundColor.lerpColors(DAY_GROUND, NIGHT_GROUND, amount)
    hemisphere.intensity = THREE.MathUtils.lerp(DAY_HEMI_INTENSITY, 0.58, amount)
    sun.color.lerpColors(DAY_SUN, NIGHT_SUN, amount)
    sun.intensity = THREE.MathUtils.lerp(DAY_SUN_INTENSITY, 0.22, amount)
    this.scene.environmentIntensity = THREE.MathUtils.lerp(0.2, 0.12, amount)
    haloMaterials.forEach((m, i) => { const [d, n] = HALO_OPACITY[i % 2]; m.opacity = THREE.MathUtils.lerp(d, n, amount) })
    warmLights.forEach((l) => { l.intensity = l.userData.day * 3 * amount })
    warmMaterials.forEach(({ material, nightIntensity }) => { material.emissiveIntensity = nightIntensity * amount })
    glowSprites.forEach((g) => { g.material.opacity = THREE.MathUtils.lerp(g.userData.day, g.userData.night, amount) })
    nightLights.forEach((light) => { light.intensity = 36 * amount })
    accentMaterial.emissive.lerpColors(DAY_ACCENT, NIGHT_ACCENT, amount)
    accentMaterial.emissiveIntensity = THREE.MathUtils.lerp(1.5, 3.8, amount)
    accentLights.forEach((light) => { light.intensity = THREE.MathUtils.lerp(7, 20, amount) })
    surfaces.forEach(({ material, dayColor, nightColor }) => { material.color.lerpColors(dayColor, nightColor, amount) })
    windowMaterial.color.lerpColors(DAY_WINDOW, NIGHT_WINDOW, amount)
    this.scene.background.lerpColors(DAY_BACKGROUND, NIGHT_BACKGROUND, amount)
  }

  setSnapshot(snap) {
    this.snap = snap
    const ev = snap.events, max = ev.length ? ev[ev.length - 1].id : 0
    if (max < this.lastEvent) this.lastEvent = 0
    if (this.primed) ev.filter((e) => e.id > this.lastEvent && e.toAgent && (e.state === 'handoff' || e.state === 'rejected')).forEach((e) => {
      const from = this.people.find((p) => p.agent.id === e.agent), to = this.people.find((p) => p.agent.id === e.toAgent)
      from && to && from.handoff(to, e.state === 'rejected')
    })
    this.lastEvent = max; this.primed = true
    this.people.forEach((p) => p.setState(snap.agents[p.agent.id]?.state || 'idle'))
    AGENTS.forEach((a, i) => drawAgentScreen(this.office.screens[i], a, snap.agents[a.id], snap.board.screens[a.id]))
    drawTv(this.office.tv, snap)
  }

  loop() {
    const dt = Math.min(this.clock.getDelta(), 0.05), t = this.clock.elapsedTime
    this.updateTheme(dt)
    this.people.forEach((p) => p.update(dt, t))
    if (this.tween) {
      const step = this.tween.target.clone().sub(this.controls.target).multiplyScalar(0.1)
      this.controls.target.add(step); this.camera.position.add(step)
      this.camera.zoom += (this.tween.zoom - this.camera.zoom) * 0.1; this.camera.updateProjectionMatrix()
      if (step.length() < 0.002 && Math.abs(this.tween.zoom - this.camera.zoom) < 0.005) this.tween = null
    }
    this.controls.update()
    if (this.idleMotion && !this.userInteracting && !this.tween && performance.now() >= this.idleResumeAt) {
      if (this.idleNeedsRebase) {
        const azimuth = this.controls.getAzimuthalAngle()
        this.idleAmplitude = Math.min(0.55, Math.max(0, this.controls.maxAzimuthAngle - azimuth - 0.02))
        this.idleBaseAzimuth = azimuth - this.idleOffset(t)
        this.idleNeedsRebase = false
      }
      const targetAzimuth = THREE.MathUtils.clamp(
        this.idleBaseAzimuth + this.idleOffset(t),
        this.controls.minAzimuthAngle + 0.01,
        this.controls.maxAzimuthAngle - 0.01,
      )
      const delta = targetAzimuth - this.controls.getAzimuthalAngle()
      if (Math.abs(delta) > 0.00001) {
        this.camera.position.sub(this.controls.target).applyAxisAngle(WORLD_UP, delta).add(this.controls.target)
        this.camera.lookAt(this.controls.target)
      }
    }
    this.renderer.render(this.scene, this.camera)
    this.raf = requestAnimationFrame(this.loop)
  }

  dispose() {
    cancelAnimationFrame(this.raf); clearInterval(this.tvTimer); removeEventListener('resize', this._resize)
    this.controls.removeEventListener('start', this._controlStart); this.controls.removeEventListener('end', this._controlEnd)
    this.controls.dispose(); this.renderer.dispose(); this.renderer.domElement.remove()
  }
}
