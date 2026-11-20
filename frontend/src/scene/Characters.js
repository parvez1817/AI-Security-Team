import * as THREE from 'three'
import { STATE_COLORS } from '../utils/constants.js'

const M = (c, r = 0.65) => new THREE.MeshStandardMaterial({ color: c, roughness: r })
const SKIN = M(0xf6dfcf, 0.55), HAIR = M(0x2a2a30, 0.45), JACKET = M(0x34353c, 0.6), SHIRT = M(0x7d8091, 0.7)
const PANTS = M(0x2f3036, 0.7), SHOE = M(0x3f3f44, 0.6), BLACK = M(0x1c1c1f, 0.4), PINK = M(0xf3b8b0, 0.8)
const part = (geo, mat, x = 0, y = 0, z = 0, p) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; p?.add(m); return m }
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 14)
const SEAT_Z = 0.9, HANDOFF_LANE_Z = 2.8

// Clay-toy employee: big round head, side-swept dark hair, grey jacket, rosy cheeks.
export class Person {
  constructor(agent, station) {
    this.agent = agent; this.station = station; this.state = 'idle'
    this.home = new THREE.Vector3(station.x, 0, station.z + SEAT_Z)
    const r = (this.root = new THREE.Group()); r.userData.agentId = agent.id
    r.position.copy(this.home); r.rotation.y = this.yaw = Math.PI
    this.sit = 1; this.walkAmt = 0; this.steps = []; this.carry = null

    const torso = part(cap(0.36, 0.5), JACKET, 0, 1.25, 0, r); torso.scale.set(1.12, 1, 0.78)
    part(new THREE.BoxGeometry(0.34, 0.62, 0.06), SHIRT, 0, 1.25, 0.29, r)
    part(new THREE.SphereGeometry(0.07, 12, 8), M(agent.color, 0.4), 0.2, 1.42, 0.32, r)
    const head = (this.head = new THREE.Group()); head.position.y = 2.05; r.add(head)
    part(new THREE.SphereGeometry(0.5, 32, 24), SKIN, 0, 0, 0, head).scale.set(1, 0.95, 0.95)
    for (const s of [-1, 1]) {
      part(new THREE.SphereGeometry(0.13, 16, 12), SKIN, s * 0.5, -0.03, 0, head)
      part(new THREE.SphereGeometry(0.06, 12, 8), BLACK, s * 0.19, -0.03, 0.46, head)
      part(new THREE.BoxGeometry(0.2, 0.04, 0.04), HAIR, s * 0.19, 0.12, 0.46, head).rotation.z = s * -0.08
      part(new THREE.SphereGeometry(0.09, 12, 8), PINK, s * 0.3, -0.12, 0.37, head).scale.set(1, 1, 0.3)
    }
    const smile = part(new THREE.TorusGeometry(0.07, 0.014, 6, 14, Math.PI), M(0xd98b6f), 0, -0.14, 0.47, head); smile.rotation.z = Math.PI
    part(new THREE.SphereGeometry(0.54, 32, 16, 0, Math.PI * 2, 0, 1.75), HAIR, 0, 0.06, -0.05, head)
    const bang = part(new THREE.SphereGeometry(0.4, 20, 12), HAIR, -0.12, 0.38, 0.22, head); bang.scale.set(0.95, 0.38, 0.6); bang.rotation.z = 0.35

    this.arms = [-1, 1].map((s) => {
      const g = new THREE.Group(); g.position.set(s * 0.5, 1.6, 0); r.add(g)
      part(cap(0.12, 0.4), JACKET, 0, -0.3, 0, g); part(new THREE.SphereGeometry(0.14, 12, 8), SKIN, 0, -0.62, 0, g); g.userData.s = s; return g
    })
    this.hips = [-1, 1].map((s) => {
      const hip = new THREE.Group(); hip.position.set(s * 0.2, 0.9, 0); r.add(hip); hip.userData.s = s
      part(cap(0.15, 0.4), PANTS, 0, -0.3, 0, hip)
      const knee = new THREE.Group(); knee.position.y = -0.55; hip.add(knee)
      part(cap(0.14, 0.3), PANTS, 0, -0.25, 0, knee); part(new THREE.SphereGeometry(0.17, 12, 8), SHOE, 0, -0.47, 0.08, knee).scale.set(1.1, 0.6, 1.5)
      hip.userData.knee = knee; return hip
    })
    this.paper = part(new THREE.BoxGeometry(0.45, 0.03, 0.6), M(0xffffff, 0.9), 0.2, 1.15, 0.6, r); this.paper.visible = false

    this.labelCanvas = Object.assign(document.createElement('canvas'), { width: 256, height: 64 })
    this.labelTex = new THREE.CanvasTexture(this.labelCanvas); this.labelTex.colorSpace = THREE.SRGBColorSpace
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.labelTex, depthTest: false, transparent: true }))
    this.label.scale.set(2.6, 0.65, 1); this.label.position.y = 3.35; this.label.renderOrder = 10; r.add(this.label)
    this.drawLabel()
  }

  drawLabel() {
    const g = this.labelCanvas.getContext('2d'); g.clearRect(0, 0, 256, 64)
    g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.roundRect(4, 8, 248, 48, 24); g.fill()
    g.shadowColor = this.agent.color; g.shadowBlur = 8; g.strokeStyle = this.agent.color; g.lineWidth = 3.5; g.stroke(); g.shadowBlur = 0
    g.fillStyle = STATE_COLORS[this.state]; g.beginPath(); g.arc(34, 32, 11, 0, 7); g.fill()
    g.fillStyle = '#1b2233'; g.font = 'bold 27px system-ui'; g.fillText(this.agent.short, 56, 42)
    this.labelTex.needsUpdate = true
  }
  setState(s) { if (s !== this.state) { this.state = s; this.drawLabel() } }

  pathTo(target) {
    const a = this.station, b = target.station, V = (x, z) => new THREE.Vector3(x, 0, z)
    return [V(a.x, HANDOFF_LANE_Z), V(b.x, HANDOFF_LANE_Z)]
  }
  handoff(target, rejected) {
    const out = this.pathTo(target), back = out.slice(0, -1).reverse().concat([this.home.clone()])
    this.steps.push(
      { k: 'do', fn: () => { this.paper.material.color.set(rejected ? 0xe5484d : 0xffffff); this.paper.visible = true } },
      { k: 'pose', to: 0 }, { k: 'walk', pts: out }, { k: 'face', yaw: Math.PI, t: 0.7 },
      { k: 'do', fn: () => { this.paper.visible = false } },
      { k: 'walk', pts: back }, { k: 'pose', to: 1 }, { k: 'face', yaw: Math.PI, t: 0.1 })
  }

  update(dt, t) {
    this.walkAmt = 0
    const s = this.steps[0]
    if (s) {
      if (s.k === 'pose') { const d = s.to - this.sit, st = dt * 2.5; Math.abs(d) <= st ? (this.sit = s.to, this.steps.shift()) : (this.sit += Math.sign(d) * st) }
      else if (s.k === 'walk') {
        const p = s.pts[0], v = p.clone().sub(this.root.position); v.y = 0; const dist = v.length()
        if (dist < 0.08) { s.pts.shift(); if (!s.pts.length) this.steps.shift() }
        else { this.walkAmt = 1; v.normalize(); this.yaw = Math.atan2(v.x, v.z); this.root.position.addScaledVector(v, Math.min(dist, dt * 3.2)) }
      } else if (s.k === 'face') { this.yaw = s.yaw; if ((s.t -= dt) <= 0) this.steps.shift() }
      else { s.fn(); this.steps.shift() }
    }
    let dy = this.yaw - this.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.root.rotation.y += dy * Math.min(1, dt * 9)
    const sit = this.sit, w = this.walkAmt, typing = this.state === 'working' && sit > 0.95 ? 1 : 0
    this.root.position.y = -0.15 * sit + Math.abs(Math.sin(t * 8)) * 0.05 * w
    this.hips.forEach((h) => { const s2 = h.userData.s, sw = Math.sin(t * 8) * s2 * 0.55 * w; h.rotation.x = -Math.PI / 2 * sit + sw; h.userData.knee.rotation.x = Math.PI / 2 * sit + Math.max(0, -sw) * 0.8 })
    this.arms.forEach((a) => {
      const s2 = a.userData.s, carrying = this.paper.visible && s2 === 1
      a.rotation.x = -1.0 * sit - (carrying ? 1.1 : 0) - Math.sin(t * 8) * s2 * 0.5 * w * (carrying ? 0 : 1) + typing * Math.sin(t * 14 + s2 * 2) * 0.12
      a.rotation.z = s2 * 0.08 * (1 - sit)
    })
    this.head.rotation.x = typing * Math.sin(t * 2) * 0.04
  }
}
