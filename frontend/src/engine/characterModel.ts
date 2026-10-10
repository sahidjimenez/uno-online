import * as THREE from 'three'
import { HAIR_COLORS, CLOTHING_COLORS, type CharacterAppearance } from '../lib/character'

/** Adult proportions, smooth silhouettes; the same model is used seated and standing. */
export function createCharacter(appearance: CharacterAppearance, seated = false) {
  const group = new THREE.Group()
  const resources: { dispose: () => void }[] = []
  const material = (color: string, roughness = 0.8) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness })
    resources.push(mat); return mat
  }
  const skin = material('#edbc86', 0.65), hair = material('#71432c', 0.6), shirt = material('#3b9b7b', 0.72)
  const pants = material('#20232b'), shoes = material('#f3f0e7', 0.5), eyes = material('#252831')
  const sole = material('#e0e1d9'), lips = material('#754a38'), glint = material('#fff8e8')
  function part(geometry: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) {
    resources.push(geometry)
    const object = new THREE.Mesh(geometry, mat)
    object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true
    group.add(object); return object
  }
  const ellipsoid = (x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: THREE.Material) => {
    const object = part(new THREE.SphereGeometry(1, 24, 18), mat, x, y, z)
    object.scale.set(sx, sy, sz); return object
  }
  function limb(start: [number, number, number], end: [number, number, number], radius: number, mat: THREE.Material) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end)
    const midpoint = a.clone().add(b).multiplyScalar(0.5)
    const object = part(new THREE.CapsuleGeometry(radius, Math.max(0.001, a.distanceTo(b) - radius * 2), 8, 16), mat, midpoint.x, midpoint.y, midpoint.z)
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize())
    return object
  }
  const hipY = seated ? 0.91 : 1.32
  const shoulderY = hipY + 0.83
  const headY = shoulderY + 0.37
  // Lathed cloth tapers at the waist and rounds over the shoulders.
  const profile = [[0, 0], [0.24, 0], [0.28, 0.09], [0.265, 0.3], [0.32, 0.59], [0.35, 0.72], [0.3, 0.8], [0.13, 0.86], [0, 0.86]]
  const contour = new THREE.CatmullRomCurve3(profile.map(([r, y]) => new THREE.Vector3(r, y, 0)))
  const body = part(new THREE.LatheGeometry(contour.getPoints(64).map(p => new THREE.Vector2(Math.max(0, p.x), p.y)), 40), shirt, 0, hipY, 0)
  body.scale.z = 0.65
  ellipsoid(0, hipY - 0.02, 0, 0.265, 0.15, 0.185, pants)
  limb([0, shoulderY - 0.04, 0], [0, headY - 0.15, 0], 0.092, skin)
  ellipsoid(0, headY, 0, 0.235, 0.27, 0.215, skin)
  for (const side of [-1, 1]) {
    ellipsoid(side * 0.229, headY - 0.005, 0, 0.041, 0.063, 0.043, skin)
    ellipsoid(side * 0.077, headY + 0.025, 0.202, 0.018, 0.027, 0.012, eyes)
    ellipsoid(side * 0.077 - 0.005, headY + 0.035, 0.213, 0.005, 0.007, 0.003, glint)
    const brow = ellipsoid(side * 0.079, headY + 0.086, 0.193, 0.039, 0.01, 0.012, hair)
    brow.rotation.z = side * -0.08
  }
  ellipsoid(0, headY - 0.025, 0.214, 0.034, 0.055, 0.037, skin)
  const smile = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.043, headY - 0.098, 0.195), new THREE.Vector3(0, headY - 0.132, 0.207), new THREE.Vector3(0.043, headY - 0.098, 0.195))
  part(new THREE.TubeGeometry(smile, 16, 0.007, 8, false), lips, 0, 0, 0)
  const cap = part(new THREE.SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.49), hair, 0, headY + 0.045, -0.017)
  cap.scale.set(0.249, 0.25, 0.231)
  const fringe = ellipsoid(-0.034, headY + 0.235, 0.095, 0.225, 0.095, 0.155, hair)
  fringe.rotation.z = -0.25
  const longHair = ellipsoid(0, headY - 0.08, -0.142, 0.263, 0.36, 0.14, hair)
  const locks = [-1, 1].map(side => ellipsoid(side * 0.22, headY - 0.12, -0.018, 0.075, 0.28, 0.092, hair))
  const ponytail = ellipsoid(0, headY - 0.04, -0.3, 0.115, 0.3, 0.12, hair)
  ponytail.rotation.x = -0.3
  const hairTie = ellipsoid(0, headY + 0.13, -0.247, 0.093, 0.036, 0.072, pants)
  const curls: THREE.Mesh[] = []
  for (let row = 0; row < 3; row++) {
    const angle = 0.3 + row * 0.48
    const count = row === 0 ? 5 : 10
    for (let i = 0; i < count; i++) {
      const around = i * Math.PI * 2 / count + row * 0.27
      curls.push(ellipsoid(Math.sin(around) * Math.sin(angle) * 0.242,
        headY + 0.04 + Math.cos(angle) * 0.245,
        -0.015 + Math.cos(around) * Math.sin(angle) * 0.225, 0.079, 0.074, 0.079, hair))
    }
  }
  let poseArm = (_amount: number) => {}
  let playingHand: THREE.Mesh
  for (const side of [-1, 1]) {
    limb([side * 0.27, shoulderY - 0.08, 0], [side * 0.385, shoulderY - 0.31, 0.01], 0.115, shirt)
    const elbow: [number, number, number] = [side * 0.41, shoulderY - 0.47, 0.055]
    const upperArm = limb([side * 0.37, shoulderY - 0.24, 0], elbow, 0.087, skin)
    const wrist: [number, number, number] = [side * 0.39, seated ? shoulderY - 0.4 : shoulderY - 0.78, seated ? 0.38 : 0.06]
    const forearm = limb(elbow, wrist, 0.076, skin)
    const hand = ellipsoid(wrist[0], wrist[1] - (seated ? 0 : 0.045), wrist[2] + (seated ? 0.065 : 0), 0.083, seated ? 0.058 : 0.108, seated ? 0.108 : 0.059, skin)
    if (side === 1) {
      playingHand = hand
      const shoulder = new THREE.Vector3(0.37, shoulderY - 0.24, 0)
      const restElbow = new THREE.Vector3(...elbow), restWrist = new THREE.Vector3(...wrist)
      const upperLength = shoulder.distanceTo(restElbow), lowerLength = restElbow.distanceTo(restWrist)
      const fit = (mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, length: number) => {
        mesh.position.copy(a).add(b).multiplyScalar(0.5)
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
        mesh.scale.y = a.distanceTo(b) / length
      }
      poseArm = amount => {
        if (!seated) return
        const t = THREE.MathUtils.clamp(amount, 0, 1)
        const e = restElbow.clone().lerp(new THREE.Vector3(0.34, shoulderY - 0.1, 0.35), t)
        const w = restWrist.clone().lerp(new THREE.Vector3(0.12, shoulderY - 0.08, 0.78), t)
        fit(upperArm, shoulder, e, upperLength); fit(forearm, e, w, lowerLength)
        hand.position.copy(w); hand.position.z += 0.065
      }
    }
    const kneeZ = seated ? 0.52 : 0
    const kneeY = seated ? 0.79 : 0.72
    limb([side * 0.145, hipY - 0.035, 0], [side * 0.15, kneeY, kneeZ], 0.135, pants)
    limb([side * 0.15, kneeY, kneeZ], [side * 0.15, 0.17, kneeZ], 0.103, pants)
    ellipsoid(side * 0.15, 0.11, kneeZ + 0.075, 0.117, 0.098, 0.223, shoes)
    ellipsoid(side * 0.15, 0.045, kneeZ + 0.075, 0.119, 0.034, 0.225, sole)
    ellipsoid(side * 0.15, 0.169, kneeZ + 0.032, 0.075, 0.044, 0.108, shoes)
    for (let lace = 0; lace < 3; lace++) {
      limb([side * 0.15 - 0.057, 0.204 - lace * 0.007, kneeZ + 0.027 + lace * 0.033], [side * 0.15 + 0.057, 0.204 - lace * 0.007, kneeZ + 0.027 + lace * 0.033], 0.009, sole)
    }
  }
  function update(next: CharacterAppearance) {
    hair.color.set(HAIR_COLORS.find(color => color.id === next.hair)!.hex)
    for (const [field, mat] of [['shirt', shirt], ['pants', pants], ['shoes', shoes]] as const) mat.color.set(CLOTHING_COLORS.find(color => color.id === next[field])!.hex)
    const style = next.hairstyle ?? (next.gender === 'woman' ? 'long' : 'quiff')
    fringe.visible = style === 'quiff' || style === 'long'
    longHair.visible = style === 'long'; locks.forEach(lock => { lock.visible = style === 'long' })
    ponytail.visible = hairTie.visible = style === 'ponytail'
    curls.forEach(curl => { curl.visible = style === 'curly' })
    body.scale.x = next.gender === 'woman' ? 0.94 : 1
  }
  update(appearance)
  return { group, update, poseArm, handPosition: () => playingHand.getWorldPosition(new THREE.Vector3()), dispose: () => resources.forEach(resource => resource.dispose()) }
}
