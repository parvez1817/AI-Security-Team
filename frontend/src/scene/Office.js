import * as THREE from 'three'
import { makeScreen } from './Monitors.js'
import { AGENTS } from '../utils/constants.js'

const DESK_SPACING = 3
const DISPLAY_ORDER = ['manager', 'pentest', 'implementer', 'risk', 'crypto', 'sast']
const layoutAgents = [...AGENTS].sort((a, b) => {
  const rank = (agent) => {
    const preferred = DISPLAY_ORDER.indexOf(agent.id)
    return preferred === -1 ? DISPLAY_ORDER.length + AGENTS.indexOf(agent) : preferred
  }
  return rank(a) - rank(b)
})
const stationByAgent = new Map(layoutAgents.map((agent, index) => [
  agent.id,
  { x: (index - (AGENTS.length - 1) / 2) * DESK_SPACING, z: 0 },
]))
export const STATIONS = AGENTS.map((agent) => stationByAgent.get(agent.id))
export const OFFICE_WIDTH = Math.max(25.2, (AGENTS.length - 1) * DESK_SPACING + 6.3)
export const MONITOR_Y = 2.3

const mat = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r })
function box(w, h, d, c, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c))
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m
}
function wallLine(x1, y1, x2, y2, z, material, parent) {
  const dx = x2 - x1, dy = y2 - y1
  const line = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(dx, dy), 0.055, 0.035), material)
  line.position.set((x1 + x2) / 2, (y1 + y2) / 2, z)
  line.rotation.z = Math.atan2(dy, dx); parent.add(line); return line
}
function glowTexture(rgb) {
  const c = Object.assign(document.createElement('canvas'), { width: 128, height: 128 }), g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, `rgba(${rgb},0.95)`); grad.addColorStop(0.35, `rgba(${rgb},0.38)`); grad.addColorStop(1, `rgba(${rgb},0)`)
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
function themeSurface(mesh, nightColor) {
  return { material: mesh.material, dayColor: mesh.material.color.clone(), nightColor: new THREE.Color(nightColor) }
}

export function buildOffice(scene) {
  const root = new THREE.Group(); scene.add(root)
  const surfaces = []
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b8dff, emissive: 0x2f7bff, emissiveIntensity: 1.5, roughness: 0.3, metalness: 0.1,
  })
  // Soft translucent halos that sit behind every neon strip so it reads as glowing light, not a painted line.
  const haloMaterials = [0.2, 0.09].map((opacity) => new THREE.MeshBasicMaterial({ color: 0x3d86ff, transparent: true, opacity, depthWrite: false }))
  const addHalo = (mesh, length, thickness, depth = 0.02) => {
    haloMaterials.forEach((material, i) => {
      const halo = new THREE.Mesh(new THREE.BoxGeometry(length + 0.1 * (i + 1), thickness + 0.14 * (i + 1) ** 1.4, depth), material)
      halo.position.z = -0.012; mesh.add(halo)
    })
  }
  // warm key lights: floor lamp + wall sconce (the amber pools visible in the reference render)
  const warmMaterials = []
  const warmLights = [[-5.0, 3.1, -4.4, 9], [-OFFICE_WIDTH / 2 + 1.1, 3.4, -0.6, 6], [OFFICE_WIDTH / 2 - 2.7, 2.7, -5.0, 5]].map(([x, y, z, power]) => {
    const light = new THREE.PointLight(0xffb96b, power, 9, 2); light.position.set(x, y, z); scene.add(light); light.userData.day = power; return light
  })
  const glowSprites = []
  const warmGlow = glowTexture('255,196,120')
  const addGlow = (x, y, z, size, day, night) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: warmGlow, transparent: true, depthWrite: false, opacity: day }))
    sp.position.set(x, y, z); sp.scale.set(size, size, 1); sp.userData = { day, night }; scene.add(sp); glowSprites.push(sp); return sp
  }
  // light
  const hemisphere = new THREE.HemisphereLight(0xf4f7ff, 0xcfd4e2, 1.25)
  scene.add(hemisphere)
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.75)
  sun.position.set(8, 14, 7); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, far: 50 }); scene.add(sun)
  const nightLightCount = Math.min(4, Math.max(1, AGENTS.length))
  const nightLights = Array.from({ length: nightLightCount }, (_, i) => {
    const rowHalfWidth = (AGENTS.length - 1) * DESK_SPACING / 2
    const x = nightLightCount === 1 ? 0 : -rowHalfWidth + (2 * rowHalfWidth * i) / (nightLightCount - 1)
    const light = new THREE.PointLight(0xffc982, 0, 12, 2)
    light.position.set(x, 4.15, 0.7); scene.add(light); return light
  })
  const accentLights = [-8, 0, 8].map((x) => {
    const light = new THREE.PointLight(0x287eff, 0, 14, 2)
    light.position.set(x, 3.35, -5.15); scene.add(light); return light
  })

  // Floor slab, tiled surface, and two cut-away walls.
  surfaces.push(themeSurface(box(OFFICE_WIDTH, 0.3, 12.6, 0xc2c8d6, 0, -0.15, 0, root), 0x282e3b))
  surfaces.push(themeSurface(box(OFFICE_WIDTH - 0.8, 0.04, 11.8, 0xb4bccd, 0, 0.02, 0, root), 0x414452))
  const floorTop = box(OFFICE_WIDTH - 2, 0.02, 10.6, 0xa6aec2, 0, 0.04, 0, root)
  Object.assign(floorTop.material, { roughness: 0.28, metalness: 0.12, envMapIntensity: 1.1 })
  surfaces.push(themeSurface(floorTop, 0x292f3d))
  const tileSeam = mat(0xa9b1c4)
  for (let z = -4.8; z <= 4.8; z += 2.4) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(OFFICE_WIDTH - 2, 0.012, 0.018), tileSeam)
    seam.position.set(0, 0.058, z); root.add(seam)
  }
  for (let x = -10.5; x <= 10.5; x += 2.5) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 10.6), tileSeam)
    seam.position.set(x, 0.058, 0); root.add(seam)
  }
  const leftWallX = -OFFICE_WIDTH / 2 + 0.15
  surfaces.push(themeSurface(box(0.3, 4.5, 12.6, 0xd2d7e3, leftWallX, 2.25, 0, root), 0x3b4050))
  surfaces.push(themeSurface(box(OFFICE_WIDTH, 4.5, 0.3, 0xc4cad8, 0, 2.25, -6.15, root), 0x3b4050))
  surfaces.push(themeSurface(box(0.34, 0.12, 12.64, 0xf6f8fc, leftWallX, 4.56, 0, root), 0x596174))
  surfaces.push(themeSurface(box(OFFICE_WIDTH + 0.04, 0.12, 0.34, 0xf6f8fc, 0, 4.56, -6.15, root), 0x596174))
  const panelShape = new THREE.Shape([[-9.2, 0.28], [10.05, 0.32], [7.45, 4.08], [5.2, 4.28], [-4.75, 4.28], [-6.55, 4.23]].map(([x, y]) => new THREE.Vector2(x, y)))
  const panel = new THREE.Mesh(new THREE.ShapeGeometry(panelShape), new THREE.MeshStandardMaterial({ color: 0xdde2ee, roughness: 0.55 }))
  panel.position.z = -5.99; panel.receiveShadow = true; root.add(panel); surfaces.push(themeSurface(panel, 0x2a3040))
  const plinth = box(OFFICE_WIDTH + 0.5, 0.55, 13.1, 0xaeb6c8, 0, -0.58, 0, root); surfaces.push(themeSurface(plinth, 0x161c2a))
  const plinthLip = new THREE.Mesh(new THREE.BoxGeometry(OFFICE_WIDTH + 0.54, 0.05, 0.05), accentMaterial); plinthLip.position.set(0, -0.36, 6.58); root.add(plinthLip)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), new THREE.ShadowMaterial({ opacity: 0.16 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.87; ground.receiveShadow = true; root.add(ground)
  { const l = wallLine(-OFFICE_WIDTH / 2 + 0.25, 4.28, OFFICE_WIDTH / 2 - 0.25, 4.28, -5.965, accentMaterial, root); addHalo(l, l.geometry.parameters.width, 0.055) }
  { const l = wallLine(-OFFICE_WIDTH / 2 + 0.25, 0.24, OFFICE_WIDTH / 2 - 0.25, 0.24, -5.965, accentMaterial, root); addHalo(l, l.geometry.parameters.width, 0.055) }
  { const l = wallLine(-12.35, 0.28, -9.2, 0.28, -5.965, accentMaterial, root); addHalo(l, l.geometry.parameters.width, 0.055) }
  { const l = wallLine(-9.2, 0.28, -6.55, 4.23, -5.965, accentMaterial, root); addHalo(l, l.geometry.parameters.width, 0.055) }
  { const l = wallLine(-6.55, 4.23, -4.75, 4.28, -5.965, accentMaterial, root); addHalo(l, l.geometry.parameters.width, 0.055) }
  { const l = wallLine(5.2, 4.28, 7.45, 4.08, -5.965, accentMaterial, root); addHalo(l, l.geometry.parameters.width, 0.055) }
  { const l = wallLine(7.45, 4.08, 10.05, 0.32, -5.965, accentMaterial, root); addHalo(l, l.geometry.parameters.width, 0.055) }
  { const l = wallLine(10.05, 0.32, 12.35, 0.28, -5.965, accentMaterial, root); addHalo(l, l.geometry.parameters.width, 0.055) }
  const floorStrips = [
    new THREE.Mesh(new THREE.BoxGeometry(OFFICE_WIDTH - 0.3, 0.04, 0.06), accentMaterial),
    new THREE.Mesh(new THREE.BoxGeometry(OFFICE_WIDTH - 0.3, 0.04, 0.06), accentMaterial),
    new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 11.9), accentMaterial),
    new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 11.9), accentMaterial),
  ]
  floorStrips.forEach((strip) => root.add(strip))
  const stripGlow = [0.28, 0.12].map((opacity) => new THREE.MeshBasicMaterial({ color: 0x3d86ff, transparent: true, opacity, depthWrite: false }))
  floorStrips.forEach((strip, i) => stripGlow.forEach((material, k) => {
    const w = (k + 1) * 0.16, long = strip.geometry.parameters.width > 1 ? strip.geometry.parameters.width : strip.geometry.parameters.depth
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(i < 2 ? long : w + 0.06, i < 2 ? w + 0.06 : long), material)
    halo.rotation.x = -Math.PI / 2; halo.position.y = -0.015 + k * 0.001; strip.add(halo)
  }))
  haloMaterials.push(...stripGlow)
  floorStrips[0].position.set(0, 0.085, -5.95)
  floorStrips[1].position.set(0, 0.085, 5.95)
  floorStrips[2].position.set(-OFFICE_WIDTH / 2 + 0.15, 0.085, 0)
  floorStrips[3].position.set(OFFICE_WIDTH / 2 - 0.15, 0.085, 0)

  // Window on the left wall, facing into the room.
  const wall = new THREE.Group(); wall.position.set(leftWallX + 0.18, 0, 0); wall.rotation.y = Math.PI / 2; root.add(wall)
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.3), new THREE.MeshBasicMaterial({ color: 0xeaf6ff }))
  glass.position.set(-1.8, 2.8, 0.02); wall.add(glass)
  box(3.4, 0.12, 0.14, 0xffffff, -1.8, 4.0, 0.06, wall); box(3.4, 0.12, 0.14, 0xffffff, -1.8, 1.62, 0.06, wall)
  box(0.12, 2.5, 0.14, 0xffffff, -3.45, 2.8, 0.06, wall); box(0.12, 2.5, 0.14, 0xffffff, -0.15, 2.8, 0.06, wall)
  box(0.06, 2.3, 0.1, 0xffffff, -1.8, 2.8, 0.06, wall); box(3.2, 0.06, 0.1, 0xffffff, -1.8, 2.8, 0.06, wall)
  box(3.7, 0.1, 0.35, 0xffffff, -1.8, 1.5, 0.2, wall)
  const clockX = -9.55
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 32), mat(0xffffff)); clock.rotation.x = Math.PI / 2; clock.position.set(clockX, 3.6, -5.92); root.add(clock)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 8, 32), mat(0x222222)); ring.position.set(clockX, 3.6, -5.87); root.add(ring)
  box(0.04, 0.34, 0.02, 0x222222, clockX, 3.72, -5.84, root); box(0.28, 0.04, 0.02, 0x222222, clockX + 0.1, 3.6, -5.84, root)

  // back wall: TV (live team stats) + framed art
  const tv = makeScreen(1024, 600)
  box(4.3, 2.5, 0.12, 0x2b2b2e, 2.8, 2.9, -5.9, root)
  const tvPlane = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 2.2), tv.mat); tvPlane.position.set(2.8, 2.9, -5.83); root.add(tvPlane)
  box(1.1, 1.5, 0.06, 0x5a2e22, -2.2, 3.0, -5.92, root); box(0.9, 1.3, 0.02, 0xf1ece6, -2.2, 3.0, -5.88, root); box(0.4, 0.7, 0.02, 0x222222, -2.2, 2.9, -5.86, root)

  // coffee cabinet, wall shelf, plant, and tripod floor lamp
  const cabinetX = OFFICE_WIDTH / 2 - 2.2, cabinetZ = 1.8
  box(2, 1.05, 1.2, 0x686a70, cabinetX, 0.58, cabinetZ, root)
  box(2.08, 0.09, 1.3, 0xd4d0c9, cabinetX, 1.15, cabinetZ, root)
  for (const x of [cabinetX - 0.48, cabinetX + 0.48]) {
    box(0.86, 0.76, 0.035, 0x777980, x, 0.58, cabinetZ + 0.62, root)
    box(0.035, 0.2, 0.05, 0xc9a66c, x + 0.28, 0.58, cabinetZ + 0.67, root)
  }
  box(0.56, 0.5, 0.46, 0x34363b, cabinetX - 0.48, 1.46, cabinetZ, root)
  box(0.42, 0.1, 0.42, 0x24262a, cabinetX - 0.48, 1.2, cabinetZ + 0.08, root)
  const coffeePot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.23, 16), mat(0x694633))
  coffeePot.position.set(cabinetX - 0.48, 1.3, cabinetZ + 0.16); root.add(coffeePot)
  for (const x of [cabinetX + 0.2, cabinetX + 0.52]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.17, 16), mat(0xf5f2ed))
    cup.position.set(x, 1.28, cabinetZ + 0.12); root.add(cup)
  }
  const shelfX = OFFICE_WIDTH / 2 - 2.7
  box(2.8, 0.13, 0.52, 0x695a4c, shelfX, 3.25, -5.62, root)
  for (const x of [shelfX - 1.2, shelfX + 1.2]) box(0.08, 0.55, 0.1, 0x695a4c, x, 2.94, -5.68, root)
  const shelfBooks = [0xb57d39, 0x39485d, 0x9b4838, 0x365a4b, 0xd1ad53]
  shelfBooks.forEach((color, i) => {
    box(0.18, 0.48 + (i % 2) * 0.12, 0.25, color, shelfX - 0.65 + i * 0.22, 3.57 + (i % 2) * 0.06, -5.67, root)
  })
  const plantX = -OFFICE_WIDTH / 2 + 1.8, plantZ = -1.6
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.9, 24), mat(0xffffff)); pot.position.set(plantX, 0.45, plantZ); pot.castShadow = true; root.add(pot)
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, leaf = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), mat(i % 2 ? 0x3f8f4d : 0x4fa05c))
    leaf.scale.set(0.55, 0.1, 0.4); leaf.position.set(plantX + Math.cos(a) * 0.5, 1.2 + (i % 3) * 0.35, plantZ + Math.sin(a) * 0.5)
    leaf.rotation.set(Math.sin(a) * 0.9, -a, Math.cos(a) * 0.9); leaf.castShadow = true; root.add(leaf)
  }
  const lamp = new THREE.Vector3(-5.0, 3.0, -5.0)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5, base = new THREE.Vector3(lamp.x + Math.cos(a) * 0.8, 0, lamp.z + Math.sin(a) * 0.8)
    const d = lamp.clone().sub(base), leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, d.length(), 6), mat(0x8b3a2a))
    leg.position.copy(base).addScaledVector(d, 0.5); leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); leg.castShadow = true; root.add(leg)
  }
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.75, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0d0, emissiveIntensity: 0 }))
  shade.position.set(lamp.x, 3.25, lamp.z); root.add(shade)
  warmMaterials.push({ material: shade.material, nightIntensity: 2.4 })
  const leafMats = [mat(0x3f8f4d), mat(0x57ad63), mat(0x2f7a42)]
  const potPlant = (px, pz, y0, scale, potColor) => {
    const potMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * scale, 0.4 * scale, 0.9 * scale, 24), mat(potColor, 0.6)); potMesh.position.set(px, y0 + 0.45 * scale, pz); potMesh.castShadow = true; root.add(potMesh)
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, leaf = new THREE.Mesh(new THREE.SphereGeometry(0.5 * scale, 12, 8), leafMats[i % 3])
      leaf.scale.set(0.5, 0.1, 0.34); leaf.position.set(px + Math.cos(a) * 0.45 * scale, y0 + (1.0 + (i % 3) * 0.32) * scale, pz + Math.sin(a) * 0.45 * scale)
      leaf.rotation.set(Math.sin(a) * 0.9, -a, Math.cos(a) * 0.9); leaf.castShadow = true; root.add(leaf)
    }
  }
  potPlant(OFFICE_WIDTH / 2 - 4.6, 0.6, 0, 1.05, 0xf4f5f8)         // plant between the last desk and the coffee bar
  potPlant(shelfX - 1.0, -5.55, 3.31, 0.22, 0xf4f5f8)               // small plant on the shelf
  for (let k = 0; k < 4; k++) {                                       // trailing vines hanging off the shelf
    const vine = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.45 + k * 0.18, 4, 8), leafMats[k % 3]); vine.position.set(shelfX + 1.25, 3.0 - k * 0.1, -5.5 + k * 0.05); root.add(vine)
  }
  // small white side table with a plant, front-left of the first desk
  box(0.8, 0.9, 0.8, 0xeef0f5, STATIONS[0].x + 1.6, 0.45, 1.4, root)
  potPlant(STATIONS[0].x + 1.6, 1.4, 0.9, 0.2, 0x2e4a6a)

  // warm pools of light on the glossy floor under each workstation
  const poolTexture = glowTexture('255,176,96')
  STATIONS.forEach(({ x, z }) => {
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: poolTexture, transparent: true, opacity: 0.42, depthWrite: false }))
    pool.rotation.x = -Math.PI / 2; pool.position.set(x, 0.07, z + 0.7); root.add(pool); glowSprites.push(pool)
    pool.userData = { day: 0, night: 0.55 }
  })
  addGlow(-5.0, 3.25, -4.9, 3.0, 0, 0.85)
  addGlow(-OFFICE_WIDTH / 2 + 0.7, 3.4, -0.6, 2.2, 0, 0.8)
  addGlow(OFFICE_WIDTH / 2 - 2.7, 3.0, -5.3, 3.2, 0, 0.65)

  // wall sconce beside the window
  box(0.18, 0.34, 0.2, 0x3a3d46, -OFFICE_WIDTH / 2 + 0.42, 3.4, -0.6, root)
  const sconceMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe2a8, emissiveIntensity: 0 })
  const sconceGlow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.14), sconceMaterial); sconceGlow.position.set(-OFFICE_WIDTH / 2 + 0.5, 3.4, -0.6); root.add(sconceGlow)
  warmMaterials.push({ material: sconceMaterial, nightIntensity: 2 })
  // under-shelf LED strip (warm), plus a trailing plant on the shelf
  const ledMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd9a0, emissiveIntensity: 0 })
  const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.03, 0.05), ledMaterial); ledStrip.position.set(OFFICE_WIDTH / 2 - 2.7, 3.17, -5.4); root.add(ledStrip)
  warmMaterials.push({ material: ledMaterial, nightIntensity: 1.5 })

  // workstations
  const screens = STATIONS.map(({ x, z }, i) => {
    box(2.3, 0.08, 1.1, 0xffffff, x, 0.95, z, root); box(2.31, 0.09, 0.28, 0xd9a766, x, 0.95, z - 0.05, root)
    box(0.08, 0.9, 1.0, 0xc99a5b, x - 1.05, 0.5, z, root); box(0.08, 0.9, 1.0, 0xc99a5b, x + 1.05, 0.5, z, root)
    box(0.7, 0.03, 0.26, 0xf3f3f3, x, 1.01, z + 0.3, root)
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.16, 12), mat(0xc0563a)); mug.position.set(x + 0.8, 1.07, z + 0.2); mug.castShadow = true; root.add(mug)
    // chair
    box(0.85, 0.12, 0.8, 0xe6e1d6, x, 0.62, z + 0.9, root); box(0.85, 0.85, 0.1, 0xe6e1d6, x, 1.1, z + 1.35, root)
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), mat(0x888888)); stem.position.set(x, 0.35, z + 0.9); root.add(stem)
    for (let k = 0; k < 5; k++) { const sp = box(0.5, 0.04, 0.06, 0x888888, 0, 0.1, 0, root); sp.position.set(x + Math.cos(k * 1.2566) * 0.25, 0.1, z + 0.9 + Math.sin(k * 1.2566) * 0.25); sp.rotation.y = -k * 1.2566 }
    // monitor (click target)
    const mon = new THREE.Group(); mon.position.set(x, 0, z - 0.25); mon.userData.agentId = i; root.add(mon)
    box(0.12, 0.9, 0.08, 0x333333, 0, 1.4, 0, mon); box(0.6, 0.03, 0.4, 0x333333, 0, 0.99, 0, mon)
    box(1.9, 1.15, 0.07, 0x1d1d1f, 0, MONITOR_Y, 0, mon)
    const sc = makeScreen(640, 400)
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.05), sc.mat); plane.position.set(0, MONITOR_Y, 0.04); mon.add(plane)
    return sc
  })
  return {
    screens,
    tv,
    theme: { hemisphere, sun, nightLights, accentLights, accentMaterial, haloMaterials, warmLights, warmMaterials, glowSprites, windowMaterial: glass.material, surfaces },
  }
}
