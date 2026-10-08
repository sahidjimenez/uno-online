import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { GameState, Player } from '../types'
import { canWalkTo, TABLE_RADIUS } from '../engine/roomNavigation'
import { createCharacter } from '../engine/characterModel'
import { characterForSeat, type CharacterAppearance } from '../lib/character'

interface Props {
  players: Player[]
  gameState: GameState
  playerId: string
  appearance: CharacterAppearance
  onFallback: () => void
}
const COLORS: Record<string, string> = { red: '#e77969', blue: '#639fc1', green: '#4aa993', yellow: '#d9b766', wild: '#555073' }
const LABELS: Record<string, string> = { skip: '⊘', reverse: '⇄', draw2: '+2', wild: '◇', wild4: '+4' }

export default function Room3D({ players, gameState, playerId, appearance, onFallback }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const input = useRef(new Set<string>())
  const controller = useRef<{ reset: (walk: boolean) => void; update: (players: Player[], state: GameState, appearance: CharacterAppearance) => void } | null>(null)
  const [walking, setWalking] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const container = host.current!
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }) }
    catch { setFailed(true); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.35
    container.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#182829')
    scene.fog = new THREE.Fog('#182829', 16, 32)
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 60)
    const resources: { dispose: () => void }[] = []
    function material(color: string, metalness = 0) {
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness })
      resources.push(mat)
      return mat
    }
    const wood = material('#80593c'), darkWood = material('#352b26'), brass = material('#c2a875', 0.65)
    const felt = material('#255d52'), wall = material('#233b3b'), trim = material('#172e30')
    function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene) {
      resources.push(geometry)
      const object = new THREE.Mesh(geometry, mat)
      object.position.set(x, y, z)
      object.castShadow = true
      object.receiveShadow = true
      parent.add(object)
      return object
    }
    function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D) {
      return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent)
    }
    function cylinder(radius: number, height: number, mat: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D) {
      return mesh(new THREE.CylinderGeometry(radius, radius, height, 64), mat, x, y, z, parent)
    }
    function texture(draw: (ctx: CanvasRenderingContext2D) => void, width = 512, height = 256) {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
      draw(canvas.getContext('2d')!)
      const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace
      return map
    }
    function sign(text: string, sub: string, color = '#c2e8d7') {
      return texture(ctx => {
        ctx.fillStyle = '#122d2e'; ctx.fillRect(0, 0, 512, 256)
        ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.strokeRect(8, 8, 496, 240)
        ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.font = 'bold 44px sans-serif'
        ctx.fillText(text, 256, 112, 460); ctx.font = '24px sans-serif'; ctx.fillText(sub, 256, 172, 460)
      })
    }
    const floor = material('#4f4335')
    box(18, 0.15, 18, floor, 0, -0.1, 0)
    for (let i = -9; i <= 9; i += 0.65) box(0.018, 0.012, 18, darkWood, i, 0, 0)
    box(18, 6, 0.2, wall, 0, 3, -9); box(18, 6, 0.2, wall, 0, 3, 9)
    box(0.2, 6, 18, wall, -9, 3, 0); box(0.2, 6, 18, wall, 9, 3, 0)
    for (const z of [-8.85, 8.85]) {
      box(18, 0.12, 0.12, brass, 0, 1.2, z)
      for (let x = -8; x <= 8; x += 1.25) box(0.045, 1.1, 0.08, trim, x, 0.6, z)
    }
    // A softly illuminated window, wall art and a console give the room depth.
    const windowMat = new THREE.MeshBasicMaterial({ color: '#b5ddd5' }); resources.push(windowMat)
    box(0.08, 3, 5.4, windowMat, -8.84, 3.1, -2)
    for (const z of [-4.7, -2, 0.7]) box(0.16, 3.2, 0.08, brass, -8.7, 3.1, z)
    box(0.16, 0.07, 5.5, brass, -8.7, 3.1, -2)
    const logoMap = sign('N E X O', 'C O N E C T A   ·   J U E G A'); resources.push(logoMap)
    const logoMat = new THREE.MeshBasicMaterial({ map: logoMap }); resources.push(logoMat)
    mesh(new THREE.PlaneGeometry(3.8, 1.9), logoMat, 0, 3.4, -8.83)
    box(5, 0.16, 0.9, wood, 0, 1.05, -7.8)
    for (const x of [-2.1, 2.1]) box(0.12, 1.05, 0.65, brass, x, 0.5, -7.8)
    for (let i = 0; i < 7; i++) box(0.17, 0.35 + (i % 3) * 0.09, 0.28, material(Object.values(COLORS)[i % 5]), -1.5 + i * 0.2, 1.32, -7.8)
    for (const x of [-6.9, 6.9]) {
      cylinder(0.4, 0.65, brass, x, 0.33, -6.4)
      for (let i = 0; i < 7; i++) {
        const leaf = mesh(new THREE.SphereGeometry(0.45, 10, 8), felt, x + Math.sin(i) * 0.35, 1.1 + (i % 3) * 0.3, -6.4 + Math.cos(i) * 0.3)
        leaf.scale.set(0.55, 1.8, 0.55); leaf.rotation.z = Math.sin(i) * 0.5
      }
    }
    cylinder(4.45, 0.025, material('#203d39'), 0, 0.025, 0)
    cylinder(TABLE_RADIUS, 0.2, wood, 0, 1.35, 0)
    cylinder(TABLE_RADIUS - 0.15, 0.02, brass, 0, 1.46, 0)
    cylinder(TABLE_RADIUS - 0.2, 0.025, felt, 0, 1.48, 0)
    cylinder(0.75, 1.25, darkWood, 0, 0.66, 0)
    cylinder(1.3, 0.12, brass, 0, 0.1, 0)
    const ambient = new THREE.HemisphereLight('#d6eee9', '#514534', 2.5); scene.add(ambient)
    const light = new THREE.DirectionalLight('#fff0d6', 3.5); light.position.set(-3, 7, 4)
    light.castShadow = true; light.shadow.mapSize.set(1024, 1024)
    Object.assign(light.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); light.shadow.bias = -0.001
    scene.add(light)
    cylinder(1.15, 0.14, brass, 0, 5.1, 0)
    cylinder(0.025, 1, darkWood, 0, 5.65, 0)
    const glow = new THREE.MeshBasicMaterial({ color: '#fff2cb' }); resources.push(glow)
    cylinder(1.05, 0.02, glow, 0, 5, 0)

    const dynamic = new THREE.Group(); scene.add(dynamic)
    const labels: THREE.Sprite[] = []
    const dynamicResources: { dispose: () => void }[] = []
    function clearDynamic() { dynamic.clear(); labels.length = 0; dynamicResources.splice(0).forEach(resource => resource.dispose()) }
    const cardGeometry = new THREE.PlaneGeometry(0.48, 0.72); resources.push(cardGeometry)
    const backMap = texture(ctx => {
      ctx.fillStyle = '#dbebe1'; ctx.fillRect(0, 0, 256, 384)
      ctx.fillStyle = '#163c3c'; ctx.fillRect(8, 8, 240, 368)
      ctx.strokeStyle = '#a9e6d6'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(128, 45); ctx.lineTo(228, 182); ctx.lineTo(128, 320); ctx.lineTo(28, 182); ctx.closePath(); ctx.stroke()
      ctx.fillStyle = '#c9ebdc'; ctx.textAlign = 'center'; ctx.font = 'bold 29px sans-serif'; ctx.fillText('NEXO', 128, 197)
    }, 256, 384); resources.push(backMap)
    const backMat = new THREE.MeshBasicMaterial({ map: backMap }); resources.push(backMat)
    function flatCard(mat: THREE.Material, x: number, y: number, z: number, rotation = 0, parent: THREE.Object3D = dynamic) {
      const card = new THREE.Mesh(cardGeometry, mat); card.rotation.set(-Math.PI / 2, 0, rotation); card.position.set(x, y, z); parent.add(card)
    }
    let seatCount = 0
    const chairGeometry = new THREE.BoxGeometry(0.78, 0.15, 0.8), backGeometry = new THREE.BoxGeometry(0.8, 0.95, 0.14), legGeometry = new THREE.BoxGeometry(0.07, 0.66, 0.07)
    resources.push(chairGeometry, backGeometry, legGeometry)
    const chairMat = material('#487b70'), activeMat = material('#a9e6d6')
    function update(roster: Player[], state: GameState, myAppearance: CharacterAppearance) {
      clearDynamic()
      const sorted = [...roster].sort((a, b) => a.seat_order - b.seat_order)
      const myIndex = sorted.findIndex(p => p.id === playerId)
      const ordered = myIndex < 0 ? sorted : [...sorted.slice(myIndex), ...sorted.slice(0, myIndex)]
      seatCount = ordered.length
      ordered.forEach((player, i) => {
        const angle = i * Math.PI * 2 / Math.max(1, seatCount)
        const seat = new THREE.Group(); seat.position.set(Math.sin(angle) * 3.3, 0, Math.cos(angle) * 3.3); seat.rotation.y = angle; dynamic.add(seat)
        const mat = player.id === state.current_player_id ? activeMat : chairMat
        const cushion = new THREE.Mesh(chairGeometry, mat); cushion.position.y = 0.72; seat.add(cushion)
        const back = new THREE.Mesh(backGeometry, mat); back.position.set(0, 1.15, 0.4); seat.add(back)
        for (const x of [-0.3, 0.3]) for (const z of [-0.3, 0.3]) { const leg = new THREE.Mesh(legGeometry, brass); leg.position.set(x, 0.33, z); seat.add(leg) }
        const character = createCharacter(player.id === playerId ? myAppearance : characterForSeat(player.seat_order), true)
        character.group.rotation.y = Math.PI
        seat.add(character.group); dynamicResources.push(character)
        const map = sign(player.name + (player.id === playerId && player.name !== 'Tú' ? ' · Tú' : ''), `${player.hand_count ?? 0} cartas${player.id === state.current_player_id ? ' · SU TURNO' : ''}`, player.id === state.current_player_id ? '#a9ffd9' : '#d1cfb6')
        const labelMat = new THREE.SpriteMaterial({ map, depthTest: true }); dynamicResources.push(map, labelMat)
        const label = new THREE.Sprite(labelMat); label.position.set(seat.position.x, 2.95, seat.position.z); dynamic.add(label); labels.push(label)
        const hand = new THREE.Group(); hand.position.set(Math.sin(angle) * 1.98, 1.52, Math.cos(angle) * 1.98); hand.rotation.y = angle; dynamic.add(hand)
        for (let c = 0; c < Math.min(player.hand_count ?? 0, 7); c++) flatCard(backMat, (c - (Math.min(player.hand_count ?? 0, 7) - 1) / 2) * 0.13, c * 0.003, 0, (c - 3) * 0.05, hand)
      })
      for (let i = 0; i < Math.min(state.draw_pile_count, 8); i++) flatCard(backMat, -0.45, 1.53 + i * 0.012, 0)
      if (state.top_card_type) {
        const map = texture(ctx => {
          ctx.fillStyle = '#f0eee0'; ctx.fillRect(0, 0, 256, 384)
          ctx.fillStyle = COLORS[state.top_card_color ?? 'wild']; ctx.fillRect(8, 8, 240, 368)
          ctx.strokeStyle = '#ffffff77'; ctx.lineWidth = 3; ctx.strokeRect(28, 28, 200, 328)
          ctx.fillStyle = '#fff9ed'; ctx.textAlign = 'center'; ctx.font = 'bold 96px sans-serif'
          ctx.fillText(LABELS[state.top_card_type!] ?? state.top_card_type!, 128, 220)
          ctx.font = '30px sans-serif'; ctx.fillText(LABELS[state.top_card_type!] ?? state.top_card_type!, 53, 65)
        }, 256, 384)
        const mat = new THREE.MeshBasicMaterial({ map }); dynamicResources.push(map, mat)
        flatCard(mat, 0.45, 1.56, 0, -0.12)
      }
      const statusMap = sign(state.direction === 1 ? '↻' : '↺', state.draw_stack ? `+${state.draw_stack} acumulado` : 'N E X O', COLORS[state.current_color ?? 'wild'])
      const statusMat = new THREE.MeshBasicMaterial({ map: statusMap }); dynamicResources.push(statusMap, statusMat)
      const status = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.52), statusMat); dynamicResources.push(status.geometry)
      status.rotation.x = -Math.PI / 2; status.position.set(0, 1.515, -0.8); dynamic.add(status)
    }
    let walk = false, yaw = 0, pitch = -0.48
    function reset(nextWalk: boolean) {
      walk = nextWalk; input.current.clear()
      camera.position.set(nextWalk ? 1.6 : 0, nextWalk ? 1.85 : 5.8, nextWalk ? 5.3 : 7.8)
      camera.lookAt(0, 1.3, 0)
      const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ'); yaw = euler.y; pitch = euler.x
    }
    reset(false)
    controller.current = { reset, update }
    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      renderer.setSize(width, height); camera.aspect = width / Math.max(height, 1)
      camera.fov = camera.aspect < 0.7 ? 78 : 58
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize); observer.observe(container); resize()
    let pointer: { id: number; x: number; y: number } | null = null
    const canvas = renderer.domElement
    const down = (event: PointerEvent) => { if (event.button !== 0) return; container.focus(); pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId) }
    const move = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return
      yaw -= (event.clientX - pointer.x) * 0.004
      pitch = THREE.MathUtils.clamp(pitch - (event.clientY - pointer.y) * 0.004, -1.25, 1.1)
      pointer.x = event.clientX; pointer.y = event.clientY
    }
    const up = () => { pointer = null }
    const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight']
    const keydown = (event: KeyboardEvent) => {
      if (event.target !== container) return
      if (keys.includes(event.code)) { event.preventDefault(); input.current.add(event.code) }
    }
    const keyup = (event: KeyboardEvent) => input.current.delete(event.code)
    const clearInput = () => { input.current.clear(); pointer = null }
    const lostContext = (event: Event) => { event.preventDefault(); renderer.setAnimationLoop(null); setFailed(true) }
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('webglcontextlost', lostContext)
    container.addEventListener('keydown', keydown); container.addEventListener('blur', clearInput)
    window.addEventListener('keyup', keyup); window.addEventListener('blur', clearInput)
    document.addEventListener('visibilitychange', clearInput)
    let last = 0
    renderer.setAnimationLoop(time => {
      const dt = Math.min((time - last) / 1000, 0.05); last = time
      if (document.hidden) return
      const pressed = (...codes: string[]) => codes.some(code => input.current.has(code))
      const vertical = Number(pressed('Space')) - Number(pressed('ShiftLeft', 'ShiftRight'))
      camera.position.y = THREE.MathUtils.clamp(camera.position.y + vertical * dt * 2, 1.2, 5.8)
      if (walk) {
        const forward = Number(pressed('KeyW', 'ArrowUp')) - Number(pressed('KeyS', 'ArrowDown'))
        const side = Number(pressed('KeyD', 'ArrowRight')) - Number(pressed('KeyA', 'ArrowLeft'))
        const step = dt * 2.8 / Math.max(1, Math.hypot(forward, side))
        const dx = (side * Math.cos(yaw) - forward * Math.sin(yaw)) * step
        const dz = (-side * Math.sin(yaw) - forward * Math.cos(yaw)) * step
        if (canWalkTo(camera.position.x + dx, camera.position.z, seatCount)) camera.position.x += dx
        if (canWalkTo(camera.position.x, camera.position.z + dz, seatCount)) camera.position.z += dz
      }
      camera.rotation.set(pitch, yaw, 0, 'YXZ')
      for (const label of labels) {
        const scale = Math.min(1, camera.position.distanceTo(label.position) / 6)
        label.scale.set(1.45 * scale, 0.725 * scale, 1)
      }
      renderer.render(scene, camera)
    })
    return () => {
      renderer.setAnimationLoop(null); observer.disconnect(); controller.current = null; input.current.clear()
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('webglcontextlost', lostContext)
      container.removeEventListener('keydown', keydown); container.removeEventListener('blur', clearInput)
      window.removeEventListener('keyup', keyup); window.removeEventListener('blur', clearInput); document.removeEventListener('visibilitychange', clearInput)
      clearDynamic(); resources.forEach(resource => resource.dispose()); light.shadow.dispose(); renderer.dispose(); canvas.remove()
    }
  }, [playerId])

  useEffect(() => { controller.current?.update(players, gameState, appearance) }, [players, gameState, appearance])

  function setMode(walk: boolean) { setWalking(walk); controller.current?.reset(walk); host.current?.focus() }
  return <>
    <div ref={host} className="room3d-canvas" tabIndex={0} role="region" aria-label="Sala 3D. Arrastra para mirar. Espacio para subir y Shift para bajar. En modo recorrer, usa W A S D o las flechas para caminar." />
    <div className="room3d-controls">
      <div className="room3d-mode"><button onClick={() => setMode(false)} aria-pressed={!walking}>Vista de mesa</button><button onClick={() => setMode(true)} aria-pressed={walking}>Recorrer sala</button></div>
      <p>{walking ? 'W A S D / flechas · Arrastra para mirar' : 'Arrastra para mirar · Tu mano siempre a la vista'}<br />Espacio: subir · Shift: bajar</p>
    </div>
    {walking && <div className="room3d-pad" aria-label="Controles para caminar">
      {([['KeyW', '↑', 'Avanzar'], ['KeyA', '←', 'Izquierda'], ['KeyS', '↓', 'Retroceder'], ['KeyD', '→', 'Derecha'], ['Space', 'Subir', 'Subir cámara'], ['ShiftLeft', 'Bajar', 'Bajar cámara']] as const).map(([code, icon, label]) => <button key={code} aria-label={label}
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); input.current.add(code) }}
        onPointerUp={() => input.current.delete(code)} onPointerCancel={() => input.current.delete(code)} onLostPointerCapture={() => input.current.delete(code)}
        onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); input.current.add(code) } }}
        onKeyUp={() => input.current.delete(code)} onBlur={() => input.current.delete(code)}>{icon}</button>)}
    </div>}
    {failed && <div className="room3d-error" role="alert"><strong>No se pudo mostrar la sala 3D</strong><p>Puedes seguir la partida en la vista clásica.</p><button onClick={onFallback}>Usar vista clásica</button></div>}
  </>
}
