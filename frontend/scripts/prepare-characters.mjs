import fs from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
globalThis.ProgressEvent = class { constructor(type, data) { Object.assign(this, data) } };
globalThis.FileReader = class {
 async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
 async readAsDataURL(blob) { this.result = 'data:application/octet-stream;base64,' + Buffer.from(await blob.arrayBuffer()).toString('base64'); this.onloadend?.(); }
};
const root = process.argv[2] || 'S:/modelos nexo';
const dest = new URL('../public/models/quaternius/', import.meta.url);
const load = async (pack, name) => new GLTFLoader().parseAsync(await fs.readFile(`${root}/${pack}/Individual Characters/glTF/${name}.gltf`, 'utf8'), '');
const men='Ultimate Modular Men- Feb 2022', women='Ultimate Modular Women - April 2022';
const output = async (name, scene, animations=[]) => {
 const data=await new GLTFExporter().parseAsync(scene,{binary:true,animations});
 await fs.writeFile(new URL(name+'.glb',dest),Buffer.from(data));
 console.log(name, data.byteLength);
};
function smooth(mesh) {
 const geometry=mesh.geometry.clone(); geometry.deleteAttribute('normal');
 mesh.geometry=mergeVertices(geometry, 0.00001); mesh.geometry.computeVertexNormals();
}
const hairGroup=new THREE.Group();
for(const [style,pack,name,matName] of [
 ['short',women,'Soldier','Hair'], ['quiff',men,'Suit','Hair'],
 ['long',women,'Casual','Hair_Blond'], ['curly',men,'Casual_2','Hair'],
]) {
 const asset=await load(pack,name);asset.scene.updateMatrixWorld(true);
 const head=asset.scene.getObjectByName('Head');
 const styleGroup=new THREE.Group();styleGroup.name=style;
 asset.scene.traverse(mesh=>{
  if(!mesh.isSkinnedMesh || !mesh.material.name.startsWith(matName))return;
  // Tiny eyebrow pieces stay part of the face, not the hairstyle.
  if(mesh.geometry.attributes.position.count<150)return;
  mesh.skeleton.update();
  const geometry=mesh.geometry.clone(), position=geometry.attributes.position;
  for(let i=0;i<position.count;i++) {
   const p=new THREE.Vector3().fromBufferAttribute(position,i);
   mesh.applyBoneTransform(i,p); mesh.localToWorld(p); head.worldToLocal(p);
   position.setXYZ(i,p.x,p.y,p.z);
  }
  geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');
  const hair=new THREE.Mesh(geometry,mesh.material.clone());smooth(hair);styleGroup.add(hair);
 });
 if(!styleGroup.children.length)throw new Error('Missing hair '+style);
 hairGroup.add(styleGroup);
}
await output('hairstyles',hairGroup);
for(const [gender,pack,name] of [['man',men,'Casual_2'],['woman',women,'Casual']]) {
 const asset=await load(pack,name), remove=[];
 asset.scene.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const material=mesh.material.name;
  if((gender==='man'&&material==='Hair')||(gender==='woman'&&material==='Hair_Blond')){remove.push(mesh);return;}
  let owner=mesh;while(owner.parent&&!/_(Body|Feet|Head|Legs)$/.test(owner.name))owner=owner.parent;
  const part=owner.name.split('_').at(-1);
  mesh.userData.slot=part==='Head'? (/Eyebrows|Hair_Brown/.test(material)?'brows':'face')
    : material.startsWith('Skin')?'skin':part==='Body'?'shirt':part==='Feet'?'shoes':'pants';
  smooth(mesh);
 });
 remove.forEach(mesh=>mesh.removeFromParent());
 await output(gender,asset.scene,asset.animations.filter(a=>a.name==='Idle_Neutral'));
 await fs.copyFile(`${root}/${pack}/License.txt`,new URL(`${gender}-LICENSE.txt`,dest));
}
