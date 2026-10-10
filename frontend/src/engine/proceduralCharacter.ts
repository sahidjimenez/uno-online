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
  // Continuous tapered surfaces replace separated capsule joints.
  function sweep(points: THREE.Vector3[], radii: number[], mat: THREE.Material) {
    const segments = 28, sides = 16
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array((segments + 1) * (sides + 1) * 3)
    const indices: number[] = []
    for (let i = 0; i < segments; i++) for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j, b = a + sides + 1
      indices.push(a, a + 1, b, b, a + 1, b + 1)
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setIndex(indices)
    const mesh = part(geometry, mat, 0, 0, 0)
    function reshape(nextPoints: THREE.Vector3[]) {
      const curve = new THREE.CatmullRomCurve3(nextPoints)
      const frames = curve.computeFrenetFrames(segments, false)
      for (let i = 0; i <= segments; i++) {
        const t = i / segments, center = curve.getPointAt(t)
        const rIndex = t * (radii.length - 1), lo = Math.min(radii.length - 2, Math.floor(rIndex))
        const radius = THREE.MathUtils.lerp(radii[lo], radii[lo + 1], THREE.MathUtils.smoothstep(rIndex - lo, 0, 1))
        for (let j = 0; j <= sides; j++) {
          const angle = j / sides * Math.PI * 2
          const v = center.clone().addScaledVector(frames.normals[i], Math.cos(angle) * radius)
            .addScaledVector(frames.binormals[i], Math.sin(angle) * radius)
          v.toArray(positions, (i * (sides + 1) + j) * 3)
        }
      }
      geometry.attributes.position.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere()
    }
    reshape(points)
    return { mesh, reshape }
  }
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  const hipY = seated ? 0.91 : 1.32
  const shoulderY = hipY + 0.83
  const headY = shoulderY + 0.34
  // Lathed cloth tapers at the waist and rounds over the shoulders.
  const profile = [[0, 0], [0.235, 0], [0.275, 0.035], [0.27, 0.16], [0.265, 0.32], [0.30, 0.55], [0.325, 0.68], [0.30, 0.75], [0.22, 0.80], [0.105, 0.83], [0, 0.83]]
  const contour = new THREE.CatmullRomCurve3(profile.map(([r, y]) => new THREE.Vector3(r, y, 0)))
  const body = part(new THREE.LatheGeometry(contour.getPoints(64).map(p => new THREE.Vector2(Math.max(0, p.x), p.y)), 40), shirt, 0, hipY, 0)
  body.scale.z = 0.65
  ellipsoid(0, hipY - 0.02, 0, 0.265, 0.15, 0.185, pants)
  limb([0, shoulderY - 0.04, 0], [0, headY - 0.15, 0], 0.092, skin)
  const collar = part(new THREE.TorusGeometry(0.103, 0.016, 10, 40), shirt, 0, shoulderY, 0)
  collar.rotation.x = Math.PI / 2
  const headPartsStart = group.children.length
  const face = ellipsoid(0, headY, 0, 0.235, 0.28, 0.215, skin)
  // A softer jaw and fuller cheeks, without seams between facial pieces.
  const facePositions = face.geometry.getAttribute('position')
  for (let i = 0; i < facePositions.count; i++) {
    const y = facePositions.getY(i)
    const jaw = y < -0.25 ? 1 - 0.16 * (-y - 0.25) : 1
    facePositions.setX(i, facePositions.getX(i) * jaw)
  }
  face.geometry.computeVertexNormals()
  for (const side of [-1, 1]) {
    ellipsoid(side * 0.229, headY - 0.005, 0, 0.041, 0.063, 0.043, skin)
    ellipsoid(side * 0.077, headY + 0.025, 0.202, 0.021, 0.034, 0.014, eyes)
    ellipsoid(side * 0.077 - 0.005, headY + 0.035, 0.213, 0.005, 0.007, 0.003, glint)
    const brow = ellipsoid(side * 0.079, headY + 0.105, 0.193, 0.039, 0.01, 0.012, hair)
    brow.rotation.z = side * -0.08
  }
  ellipsoid(0, headY - 0.025, 0.214, 0.034, 0.055, 0.037, skin)
  const smile = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.043, headY - 0.098, 0.195), new THREE.Vector3(0, headY - 0.132, 0.207), new THREE.Vector3(0.043, headY - 0.098, 0.195))
  part(new THREE.TubeGeometry(smile, 16, 0.007, 8, false), lips, 0, 0, 0)
  const cap = part(new THREE.SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.49), hair, 0, headY + 0.10, -0.025)
  cap.scale.set(0.246, 0.205, 0.226)
  const fringe = sweep([
    v(0.12, headY + 0.22, 0.04),
    v(0.005, headY + 0.275, 0.13),
    v(-0.14, headY + 0.17, 0.185),
    v(-0.225, headY + 0.02, 0.10),
  ], [0.055, 0.095, 0.065, 0.008], hair).mesh
  const sweptLocks = [0, 1, 2].map(i => sweep([
    v(-0.19, headY + 0.15, 0.045 - i * 0.065),
    v(-0.11, headY + 0.29 + i * 0.008, 0.12 - i * 0.07),
    v(0.07, headY + 0.27 + i * 0.012, 0.13 - i * 0.065),
    v(0.22, headY + 0.29 - i * 0.023, 0.105 - i * 0.065),
  ], [0.045, 0.092, 0.083, 0.002], hair).mesh)
  const longHair = ellipsoid(0, headY - 0.085, -0.142, 0.25, 0.34, 0.14, hair)
  const locks = [-1, 1].flatMap(side => [-1, 0, 1].map(layer => sweep([
    v(side * 0.17, headY + 0.16, -0.06 + layer * 0.06),
    v(side * 0.25, headY - 0.01, -0.065 + layer * 0.055),
    v(side * 0.265, headY - 0.2, -0.07 + layer * 0.05),
    v(side * 0.29, headY - 0.32, -0.085 + layer * 0.05),
    v(side * 0.20, headY - 0.39, -0.075 + layer * 0.05),
  ], [0.075, 0.073, 0.066, 0.05, 0.001], hair).mesh))
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
  const head = new THREE.Group()
  head.position.y = headY
  for (const object of group.children.slice(headPartsStart)) {
    object.position.y -= headY
    head.add(object)
  }
  head.scale.set(1.13, 1.04, 1.1)
  group.add(head)
  const genderShapes: { object: THREE.Object3D; femaleWidth: number }[] = []
  let poseArm = (_amount: number) => {}
  let playingHand: THREE.Group
  for (const side of [-1, 1]) {
    const sleeve = sweep([v(side * 0.23, shoulderY - 0.115, 0), v(side * 0.325, shoulderY - 0.18, 0), v(side * 0.385, shoulderY - 0.32, 0.005)], [0.075, 0.14, 0.127, 0.11], shirt)
    genderShapes.push({ object: sleeve.mesh, femaleWidth: 0.86 })
    const shoulder = v(side * 0.36, shoulderY - 0.245, 0)
    const elbow = v(side * 0.435, shoulderY - 0.54, 0.035)
    const wrist = v(side * 0.465, seated ? shoulderY - 0.4 : shoulderY - 0.87, seated ? 0.38 : 0.045)
    const arm = sweep([shoulder, elbow, wrist], [0.095, 0.103, 0.078, 0.074, 0.047], skin)
    const armGroup = new THREE.Group(); group.add(armGroup)
    armGroup.add(arm.mesh)
    genderShapes.push({ object: armGroup, femaleWidth: 0.86 })
    const hand = new THREE.Group(); armGroup.add(hand)
    hand.position.copy(wrist)
    hand.rotation.x = seated ? -Math.PI / 2 : 0
    const palm = ellipsoid(0, -0.055, 0, 0.064, 0.086, 0.04, skin); hand.add(palm)
    for (let finger = 0; finger < 4; finger++) {
      const x = (finger - 1.5) * 0.027
      const length = [0.08, 0.108, 0.098, 0.075][finger]
      const digit = limb([x, -0.1, 0], [x + side * 0.007, -0.1 - length, 0.016], 0.016, skin)
      hand.add(digit)
    }
    const thumb = limb([-side * 0.047, -0.038, 0.012], [-side * 0.077, -0.105, 0.03], 0.021, skin); hand.add(thumb)
    if (side === 1) {
      playingHand = hand
      let previousPose = -1
      poseArm = amount => {
        if (!seated) return
        const t = THREE.MathUtils.clamp(amount, 0, 1)
        if (Math.abs(t - previousPose) < 0.001) return
        previousPose = t
        const e = elbow.clone().lerp(v(0.34, shoulderY - 0.1, 0.35), t)
        const w = wrist.clone().lerp(v(0.12, shoulderY - 0.08, 0.78), t)
        arm.reshape([shoulder, e, w]); hand.position.copy(w)
      }
    }
    const kneeZ = seated ? 0.52 : 0.015
    const kneeY = seated ? 0.79 : 0.69
    const leg = sweep([v(side * 0.14, hipY, 0), v(side * 0.18, kneeY, kneeZ + (seated ? 0 : 0.055)), v(side * 0.17, 0.155, kneeZ)],
      [0.15, 0.148, 0.102, 0.112, 0.087], pants)
    genderShapes.push({ object: leg.mesh, femaleWidth: 0.96 })
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
    fringe.visible = style === 'long'
    sweptLocks.forEach(lock => { lock.visible = style === 'quiff' })
    longHair.visible = style === 'long'; locks.forEach(lock => { lock.visible = style === 'long' })
    ponytail.visible = hairTie.visible = style === 'ponytail'
    curls.forEach(curl => { curl.visible = style === 'curly' })
    body.scale.x = next.gender === 'woman' ? 0.88 : 1
    genderShapes.forEach(({ object, femaleWidth }) => { object.scale.x = next.gender === 'woman' ? femaleWidth : 1 })
  }
  update(appearance)
  return { group, update, poseArm, handPosition: () => playingHand.getWorldPosition(new THREE.Vector3()), dispose: () => resources.forEach(resource => resource.dispose()) }
}
