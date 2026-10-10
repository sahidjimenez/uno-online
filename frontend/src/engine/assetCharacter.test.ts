import { readFile } from 'node:fs/promises'
import { describe, it, expect, beforeAll } from 'vitest'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Box3, Mesh, MeshStandardMaterial } from 'three'
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
