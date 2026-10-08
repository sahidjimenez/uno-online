import * as THREE from 'three'
import { HAIR_COLORS, CLOTHING_COLORS, type CharacterAppearance } from '../lib/character'

/** Shared model for the dressing room and the seated players. Faces point along +Z. */
export function createCharacter(appearance: CharacterAppearance, seated = false) {
  const group = new THREE.Group()
  const resources: { dispose: () => void }[] = []
  const material = (color: string) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
    resources.push(mat); return mat
  }
  const skin = material('#dba77e'), hair = material('#71432c'), shirt = material('#3b9b7b')
  const pants = material('#20232b'), shoes = material('#f3f0e7'), eyes = material('#252831')
  const sole = material('#d4d5ce')
  function part(geometry: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = group) {
    resources.push(geometry)
    const object = new THREE.Mesh(geometry, mat); object.position.set(x, y, z)
    object.castShadow = true; object.receiveShadow = true; parent.add(object); return object
  }
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => part(new THREE.BoxGeometry(w, h, d), mat, x, y, z)
  const sphere = (r: number, mat: THREE.Material, x: number, y: number, z: number) => part(new THREE.SphereGeometry(r, 20, 16), mat, x, y, z)
  const bodyY = seated ? 1.12 : 1.16
  const body = part(new THREE.CylinderGeometry(0.27, 0.23, 0.58, 12), shirt, 0, bodyY, 0)
  body.scale.z = 0.68
  box(0.34, 0.14, 0.27, pants, 0, bodyY - 0.32, 0)
  const headY = bodyY + 0.53
  part(new THREE.CylinderGeometry(0.08, 0.09, 0.15, 12), skin, 0, bodyY + 0.34, 0)
  const head = sphere(0.225, skin, 0, headY, 0); head.scale.set(0.9, 1.08, 0.9)
  sphere(0.04, skin, -0.205, headY, 0); sphere(0.04, skin, 0.205, headY, 0)
  for (const x of [-0.07, 0.07]) sphere(0.022, eyes, x, headY + 0.02, 0.187)
  sphere(0.032, skin, 0, headY - 0.03, 0.204)
  const smile = part(new THREE.TorusGeometry(0.045, 0.008, 6, 16, Math.PI), eyes, 0, headY - 0.07, 0.192)
  smile.rotation.z = Math.PI
  part(new THREE.SphereGeometry(0.234, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.48), hair, 0, headY + 0.015, 0)
  const fringe = box(0.32, 0.095, 0.13, hair, -0.015, headY + 0.15, 0.115); fringe.rotation.z = -0.1
  const longHair = box(0.4, 0.4, 0.13, hair, 0, headY - 0.075, -0.13)
  const sideHair = [-1, 1].map(side => {
    const lock = sphere(0.085, hair, side * 0.18, headY - 0.08, -0.025); lock.scale.set(0.7, 2.8, 0.8); return lock
  })
  for (const side of [-1, 1]) {
    const sleeve = box(0.17, 0.27, 0.22, shirt, side * 0.29, bodyY + 0.08, 0)
    sleeve.rotation.z = side * 0.1
    const arm = box(0.12, seated ? 0.27 : 0.3, 0.13, skin, side * 0.32, bodyY - 0.16, seated ? 0.12 : 0)
    if (seated) arm.rotation.x = -0.8
    sphere(0.073, skin, side * 0.32, bodyY - 0.3, seated ? 0.22 : 0)
    if (seated) {
      box(0.17, 0.18, 0.4, pants, side * 0.12, 0.8, 0.17)
      box(0.17, 0.56, 0.18, pants, side * 0.12, 0.46, 0.33)
    } else box(0.17, 0.68, 0.21, pants, side * 0.12, 0.48, 0)
    box(0.2, 0.13, 0.34, shoes, side * 0.12, 0.105, seated ? 0.42 : 0.055)
    box(0.205, 0.035, 0.345, sole, side * 0.12, 0.035, seated ? 0.42 : 0.055)
  }
  function update(next: CharacterAppearance) {
    hair.color.set(HAIR_COLORS.find(color => color.id === next.hair)!.hex)
    for (const [field, mat] of [['shirt', shirt], ['pants', pants], ['shoes', shoes]] as const) mat.color.set(CLOTHING_COLORS.find(color => color.id === next[field])!.hex)
    longHair.visible = next.gender === 'woman'; sideHair.forEach(lock => { lock.visible = next.gender === 'woman' })
    body.scale.x = next.gender === 'woman' ? 0.9 : 1
  }
  update(appearance)
  return { group, update, dispose: () => resources.forEach(resource => resource.dispose()) }
}
