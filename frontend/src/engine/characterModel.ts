import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { createCharacter as createFallback } from './proceduralCharacter'
import { CLOTHING_COLORS, HAIR_COLORS, type CharacterAppearance } from '../lib/character'

const cache = new Map<string, Promise<GLTF>>()
function load(name: string) {
  let request = cache.get(name)
  if (!request) {
    request = new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/quaternius/${name}.glb`)
    cache.set(name, request)
    request.catch(() => cache.delete(name))
  }
  return request
}

/** Independent skeleton/materials per player; immutable geometry is shared from the cache. */
export function buildAssetCharacter(asset: GLTF, hairstyles: GLTF, appearance: CharacterAppearance, seated: boolean) {
  const group = new THREE.Group()
  const actor = clone(asset.scene)
  group.add(actor)
  const materials: THREE.Material[] = []
  const mixer = new THREE.AnimationMixer(actor)
  const idle = asset.animations.find(clip => clip.name === 'Idle_Neutral')
  if (idle) { mixer.clipAction(idle).play(); mixer.update(0); mixer.stopAllAction() }
  actor.scale.setScalar(1.5)
  actor.position.y = seated ? -0.43 : 0.005
  actor.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    object.material = (object.material as THREE.MeshStandardMaterial).clone()
    const mat = object.material as THREE.MeshStandardMaterial
    mat.roughness = 0.8; mat.metalness = 0
    materials.push(mat)
    object.castShadow = true; object.receiveShadow = true
    object.frustumCulled = false // Animated bounds can leave the exported bind-pose bounds.
  })
  const bone = (name: string) => actor.getObjectByName(name)!
  const hairRoot = new THREE.Group()
  bone('Head').add(hairRoot)
  const styles = new Map<string, THREE.Object3D>()
  for (const name of ['short', 'quiff', 'long', 'curly']) {
    const source = hairstyles.scene.getObjectByName(name)!
    const style = source.clone(true)
    style.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      object.material = (object.material as THREE.Material).clone()
      materials.push(object.material as THREE.Material)
      object.castShadow = true
    })
    styles.set(style.name, style); hairRoot.add(style)
  }
  // Ponytail uses the short fitted scalp plus a separate tied tail.
  const tailMaterial = new THREE.MeshStandardMaterial({roughness:0.8})
  const tailGeometry = new THREE.CapsuleGeometry(0.047, 0.20, 6, 12)
  const tail = new THREE.Mesh(tailGeometry, tailMaterial)
  tail.position.set(0, 0.065, -0.145); tail.rotation.x = -0.35
  tail.castShadow = true; hairRoot.add(tail); materials.push(tailMaterial)
  function pointBone(name: string, direction: THREE.Vector3) {
    const joint = bone(name)
    group.updateMatrixWorld(true)
    const worldDirection = direction.clone().transformDirection(group.matrixWorld)
    const worldRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), worldDirection)
    joint.quaternion.copy(joint.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(worldRotation))
    joint.updateMatrixWorld(true)
  }
  if (seated) for (const side of ['L','R']) {
    pointBone(`UpperLeg${side}`, new THREE.Vector3(0,-0.16,1))
    pointBone(`LowerLeg${side}`, new THREE.Vector3(0,-1,0))
    pointBone(`Foot${side}`, new THREE.Vector3(0,0,1))
  }
  function poseArm(amount: number) {
    if (!seated) return
    const t = THREE.MathUtils.clamp(amount,0,1)
    for (const side of ['L','R']) {
      const reach = side === 'R' ? t : 0
      const sign = side === 'R' ? -1 : 1
      pointBone(`UpperArm${side}`, new THREE.Vector3(sign * 0.13, -0.95 + reach * 0.66, 0.25 + reach * 0.71))
      pointBone(`LowerArm${side}`, new THREE.Vector3(-sign * 0.12, 0.12 + reach * 0.03, 1))
    }
  }
  function update(next: CharacterAppearance) {
    actor.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      const mat = object.material as THREE.MeshStandardMaterial
      const slot = object.userData.slot as 'shirt'|'pants'|'shoes'|'brows'|undefined
      if (slot === 'shirt' || slot === 'pants' || slot === 'shoes') mat.color.set(CLOTHING_COLORS.find(c => c.id === next[slot])!.hex)
      if (slot === 'brows' || hairRoot.getObjectById(object.id)) mat.color.set(HAIR_COLORS.find(c => c.id === next.hair)!.hex)
    })
    styles.forEach((style,name) => { style.visible = name === (next.hairstyle === 'ponytail' ? 'short' : next.hairstyle) })
    tail.visible = next.hairstyle === 'ponytail'
  }
  poseArm(0); update(appearance)
  return { group, update, poseArm,
    handPosition: () => bone('WristR').getWorldPosition(new THREE.Vector3()),
    dispose: () => {
      mixer.uncacheRoot(actor)
      actor.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose() })
      materials.forEach(mat => mat.dispose()); tailGeometry.dispose()
    },
  }
}

export function createCharacter(appearance: CharacterAppearance, seated = false) {
  const group = new THREE.Group()
  let current = createFallback(appearance, seated)
  group.add(current.group)
  let draft = appearance, disposed = false, generation = 0, amount = 0
  let ready: Promise<void> = Promise.resolve()
  const replace = (next: CharacterAppearance) => {
    const request = ++generation
    ready = Promise.all([load(next.gender), load('hairstyles')]).then(([asset, hairstyles]) => {
      if (disposed || request !== generation) return
      const imported = buildAssetCharacter(asset, hairstyles, draft, seated)
      group.remove(current.group); current.dispose(); current = imported
      group.add(current.group); current.poseArm(amount)
    }).catch(() => { /* Keep the usable procedural character if an asset cannot load. */ })
  }
  // No network during server rendering or geometry-only tests.
  if (typeof window !== 'undefined') replace(appearance)
  return { group,
    get ready() { return ready },
    update(next: CharacterAppearance) {
      const changed = next.gender !== draft.gender
      draft = next; current.update(next)
      if (changed && typeof window !== 'undefined') replace(next)
    },
    poseArm(value: number) { amount=value; current.poseArm(value) },
    handPosition: () => current.handPosition(),
    dispose() { disposed=true; generation++; current.dispose() },
  }
}
