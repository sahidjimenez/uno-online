import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { createCharacter } from '../engine/characterModel'
import type { CharacterAppearance } from '../lib/character'

export default function CharacterPreview({ appearance }: { appearance: CharacterAppearance }) {
  const host = useRef<HTMLDivElement>(null)
  const model = useRef<ReturnType<typeof createCharacter> | null>(null)
  const initial = useRef(appearance)
  const [rotation, setRotation] = useState(20)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const container = host.current!
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }) }
    catch { setFailed(true); return }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    container.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20)
    camera.position.set(0, 1.4, 4.2); camera.lookAt(0, 0.98, 0)
    scene.add(new THREE.HemisphereLight('#ffffff', '#728778', 2.8))
    const light = new THREE.DirectionalLight('#fff1dc', 3); light.position.set(3, 5, 4); scene.add(light)
    const character = createCharacter(initial.current); model.current = character
    character.group.rotation.y = Math.PI / 9; scene.add(character.group)
    const geometry = new THREE.CylinderGeometry(0.62, 0.68, 0.07, 48)
    const material = new THREE.MeshStandardMaterial({ color: '#365b51', roughness: 0.6 })
    const pedestal = new THREE.Mesh(geometry, material); pedestal.position.y = -0.04; scene.add(pedestal)
    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      renderer.setSize(width, height); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize); observer.observe(container); resize()
    const lost = (event: Event) => { event.preventDefault(); setFailed(true); renderer.setAnimationLoop(null) }
    renderer.domElement.addEventListener('webglcontextlost', lost)
    renderer.setAnimationLoop(() => { if (!document.hidden) renderer.render(scene, camera) })
    return () => {
      observer.disconnect(); renderer.setAnimationLoop(null); renderer.domElement.removeEventListener('webglcontextlost', lost)
      character.dispose(); model.current = null; geometry.dispose(); material.dispose(); renderer.dispose(); renderer.domElement.remove()
    }
  }, [])
  useEffect(() => { model.current?.update(appearance) }, [appearance])
  useEffect(() => { if (model.current) model.current.group.rotation.y = rotation * Math.PI / 180 }, [rotation])
  return <div className="character-preview">
    <div ref={host} className="character-preview-canvas" role="img" aria-label={`Vista previa 3D de tu personaje: ${appearance.gender === 'woman' ? 'mujer' : 'hombre'}`} />
    {failed ? <p className="character-preview-fallback" role="status">Vista 3D no disponible. Puedes elegir los colores y guardar tu personaje.</p>
      : <label className="character-rotate">Girar personaje<input type="range" min="-180" max="180" value={rotation} onChange={event => setRotation(Number(event.target.value))} /></label>}
  </div>
}
