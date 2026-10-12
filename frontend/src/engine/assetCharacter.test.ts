import { readFile } from 'node:fs/promises'
import { describe, it, expect, beforeAll } from 'vitest'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Box3, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import { buildAssetCharacter } from './characterModel'
import { DEFAULT_CHARACTER, HAIRSTYLES } from '../lib/character'
let man: GLTF, woman: GLTF, hair: GLTF
beforeAll(async () => {
 async function read(name: string) {
  const data = await readFile(new URL(`../../public/models/quaternius/${name}.glb`, import.meta.url))
  return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '')
 }
 ;[man, woman, hair] = await Promise.all([read('man'), read('woman'), read('hairstyles')])
})
describe('licensed character integration', () => {
 it('bends seated elbows without adding twist between the upper arm and forearm', () => {
  const roll = (model: ReturnType<typeof buildAssetCharacter>, side: string) => {
   model.group.updateMatrixWorld(true)
   const upper = model.group.getObjectByName(`UpperArm${side}`)!.getWorldQuaternion(new Quaternion())
   const lower = model.group.getObjectByName(`LowerArm${side}`)!.getWorldQuaternion(new Quaternion())
   const relative = upper.invert().multiply(lower)
   const axis = new Vector3(0, 1, 0).applyQuaternion(relative)
   return new Quaternion().setFromUnitVectors(axis, new Vector3(0, 1, 0)).multiply(relative)
  }
  for (const asset of [man, woman]) {
   const standing = buildAssetCharacter(asset, hair, DEFAULT_CHARACTER, false)
   const seated = buildAssetCharacter(asset, hair, DEFAULT_CHARACTER, true)
   for (const angle of [0, Math.PI / 2, Math.PI]) {
    seated.group.rotation.y = angle
    for (const amount of [0, 0.25, 0.5, 0.75, 1, 0]) {
     seated.poseArm(amount)
     for (const side of ['L', 'R']) expect(roll(seated, side).angleTo(roll(standing, side))).toBeLessThan(0.001)
    }
   }
   standing.dispose(); seated.dispose()
  }
 })
 it('keeps both palms facing down while seated, reaching, and returning at any seat', () => {
  for (const asset of [man, woman]) {
   const model = buildAssetCharacter(asset, hair, DEFAULT_CHARACTER, true)
   for (const angle of [0, Math.PI / 2, Math.PI]) {
    model.group.rotation.y = angle
    for (const amount of [0, 0.5, 1, 0.5, 0]) {
     model.poseArm(amount)
     model.group.updateMatrixWorld(true)
     for (const side of ['L', 'R']) {
      const position = (name: string) => model.group.getObjectByName(`${name}${side}`)!.getWorldPosition(new Vector3())
      const wrist = position('Wrist')
      const palm = position('Index1').sub(wrist).cross(position('Pinky1').sub(wrist))
       .multiplyScalar(side === 'L' ? 1 : -1).normalize()
      expect(palm.y).toBeLessThan(-0.95)
     }
    }
   }
   model.dispose()
  }
 })
 it('keeps seated ankles under the knees and preserves the neutral leg roll', () => {
  for (const asset of [man, woman]) {
   const standing = buildAssetCharacter(asset, hair, DEFAULT_CHARACTER, false)
   const seated = buildAssetCharacter(asset, hair, DEFAULT_CHARACTER, true)
   standing.group.updateMatrixWorld(true); seated.group.updateMatrixWorld(true)
   for (const side of ['L', 'R']) {
    const joint = (model: typeof seated, name: string) => model.group.getObjectByName(`${name}${side}`)!
    const position = (model: typeof seated, name: string) => joint(model, name).getWorldPosition(new Vector3())
    const hip = position(seated, 'UpperLeg'), knee = position(seated, 'LowerLeg'), ankle = position(seated, 'Foot')
    expect(knee.z - hip.z).toBeGreaterThan(0.5)
    expect(Math.abs(ankle.x - knee.x)).toBeLessThan(0.001)
    expect(Math.abs(ankle.z - knee.z)).toBeLessThan(0.001)
    expect(knee.y - ankle.y).toBeGreaterThan(0.6)
    expect(ankle.y).toBeGreaterThan(0)
    expect(ankle.y).toBeLessThan(0.25)
    expect(knee.distanceTo(ankle)).toBeCloseTo(position(standing, 'LowerLeg').distanceTo(position(standing, 'Foot')), 4)
    for (const name of ['UpperLeg', 'LowerLeg']) {
     const neutral = joint(standing, name).getWorldQuaternion(new Quaternion())
     const posed = joint(seated, name).getWorldQuaternion(new Quaternion())
     const originalAxis = new Vector3(0, 1, 0).applyQuaternion(neutral)
     const posedAxis = new Vector3(0, 1, 0).applyQuaternion(posed)
     const swing = new Quaternion().setFromUnitVectors(originalAxis, posedAxis)
     expect(posed.angleTo(swing.multiply(neutral))).toBeLessThan(0.001)
    }
    expect(joint(seated, 'Foot').getWorldQuaternion(new Quaternion()).angleTo(
     joint(standing, 'Foot').getWorldQuaternion(new Quaternion()))).toBeLessThan(0.001)
   }
   seated.poseArm(1)
   for (const side of ['L', 'R']) {
    const knee = seated.group.getObjectByName(`LowerLeg${side}`)!.getWorldPosition(new Vector3())
    const ankle = seated.group.getObjectByName(`Foot${side}`)!.getWorldPosition(new Vector3())
    expect(Math.abs(knee.z - ankle.z)).toBeLessThan(0.001)
   }
   standing.dispose(); seated.dispose()
  }
 })
 it('reaches and returns without moving another player skeleton', () => {
  for (const asset of [man, woman]) {
   const first = buildAssetCharacter(asset, hair, DEFAULT_CHARACTER, true)
   const second = buildAssetCharacter(asset, hair, DEFAULT_CHARACTER, true)
   const rest = first.handPosition(), untouched = second.handPosition()
   first.poseArm(1)
   expect(first.handPosition().z - rest.z).toBeGreaterThan(0.15)
   expect(first.handPosition().y).toBeGreaterThan(rest.y)
   expect(second.handPosition().distanceTo(untouched)).toBeLessThan(0.0001)
   first.poseArm(0)
   expect(first.handPosition().distanceTo(rest)).toBeLessThan(0.0001)
   const bounds = new Box3().setFromObject(first.group)
   expect(bounds.max.y).toBeGreaterThan(2)
   expect(bounds.max.y).toBeLessThan(2.6)
   first.dispose(); second.dispose()
  }
 })
 it('preserves hairstyles and isolates clothing colors', () => {
  const first = buildAssetCharacter(man, hair, DEFAULT_CHARACTER, false)
  const second = buildAssetCharacter(man, hair, DEFAULT_CHARACTER, false)
  for (const style of HAIRSTYLES) {
   first.update({...DEFAULT_CHARACTER, hairstyle:style.id, shirt:'red'})
   expect(first.group.getObjectByName(style.id === 'ponytail' ? 'short' : style.id)?.visible).toBe(true)
  }
  const shirts = (model: typeof first) => {
   const colors: string[]=[]
   model.group.traverse(o=>{if(o instanceof Mesh && o.userData.slot==='shirt')colors.push((o.material as MeshStandardMaterial).color.getHexString())})
   return colors
  }
  expect(shirts(first)).toContain('d65055'); expect(shirts(second)).toContain('3b9b7b')
  first.dispose(); second.dispose()
 })
})
