import * as THREE from 'three';
import { SHOP } from './layout';
import { box, canvasTexture, paint } from './materials';

export type ShopMaterials = { fronts: THREE.Material[]; sides: THREE.Material[]; stone: THREE.Material; roof: THREE.Material; iron: THREE.Material; gold: THREE.Material };

/** Each building has its own UV elevation on every wall, and a real pitched roof. */
export function building(parent: THREE.Group, materials: ShopMaterials, type: number, x: number, z: number, facing: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `Stone shop ${type} | complete building`;
  const { width: w, height: h, depth: d, roofRise: rise } = SHOP;
  box(group, 'Stone ground-floor walls', [w, 3.6, d], [0, 1.8, 0], materials.stone);
  box(group, 'Residential upper walls', [w, h - 3.6, d], [0, (h + 3.6) / 2, 0],
    [materials.sides[type], materials.sides[type], materials.stone, materials.stone, materials.stone, materials.sides[type]]);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), materials.fronts[type]);
  front.name = 'Painted shopfront elevation'; front.position.set(0, h / 2, d / 2 + 0.006); group.add(front);
  for (const y of [0.12, 3.65, h - 0.15, h]) {
    box(group, 'Carved stone cornice', [w + 0.2, 0.14, d + 0.2], [0, y, 0], materials.stone);
  }
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2 - 0.22, 0); shape.lineTo(0, rise); shape.lineTo(d / 2 + 0.22, 0); shape.closePath();
  const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: w + 0.44, bevelEnabled: false }), materials.roof);
  gable.rotation.y = Math.PI / 2; gable.position.set(-w / 2 - 0.22, h, 0); group.add(gable);
  const slope = Math.atan2(rise, d / 2 + 0.22);
  for (const direction of [-1, 1]) {
    const roof = box(group, 'Slate roof slope', [w + 0.5, 0.1, Math.hypot(d / 2 + 0.22, rise)], [0, h + rise / 2, direction * (d / 4 + 0.11)], materials.roof);
    roof.rotation.x = direction * slope;
  }
  box(group, 'Ridge cap', [w + 0.6, 0.13, 0.17], [0, h + rise + 0.03, 0], materials.roof);
  box(group, 'Stone chimney', [0.55, 1.4, 0.65], [-2.1, h + 1.2, -1.3], materials.stone);
  box(group, 'Chimney coping', [0.7, 0.12, 0.8], [-2.1, h + 1.94, -1.3], materials.stone);

  for (const floor of [5, 8.05]) for (const sx of [-1.55, 1.55]) {
    box(group, 'Juliet balcony stone ledge', [1.9, 0.1, 0.25], [sx, floor - 0.07, d / 2 + 0.12], materials.stone);
    box(group, 'Balcony top rail', [1.8, 0.035, 0.035], [sx, floor + 0.53, d / 2 + 0.26], materials.iron);
    for (let i = 0; i <= 8; i++) box(group, 'Balcony iron spindle', [0.018, 0.54, 0.018], [sx - 0.88 + i * 0.22, floor + 0.26, d / 2 + 0.26], materials.iron);
  }

  const colours = ['#792d38', '#294859', '#a88558'];
  const fabricMap = canvasTexture(256, 128, ctx => {
    ctx.fillStyle = colours[type]; ctx.fillRect(0, 0, 256, 128);
    for (let y = 0; y < 128; y += 3) { ctx.fillStyle = 'rgba(240,204,155,0.06)'; ctx.fillRect(0, y, 256, 1); }
    ctx.fillStyle = '#c7a261'; ctx.fillRect(0, 122, 256, 3);
  });
  const fabric = paint('#ffffff', fabricMap);
  const awning = box(group, 'Projecting fabric awning', [5.85, 0.06, 1.35], [0, 3.36, d / 2 + 0.62], fabric);
  awning.rotation.x = 0.15;
  box(group, 'Awning valance', [5.85, 0.25, 0.05], [0, 3.14, d / 2 + 1.27], fabric);
  for (const sx of [-2.8, 2.8]) {
    const strut = box(group, 'Awning iron support', [0.035, 0.035, 1.45], [sx, 3.22, d / 2 + 0.6], materials.iron);
    strut.rotation.x = -0.12;
  }
  const signMap = canvasTexture(512, 320, ctx => {
    ctx.fillStyle = '#222c2b'; ctx.fillRect(0, 0, 512, 320);
    ctx.strokeStyle = '#ba995a'; ctx.lineWidth = 9; ctx.strokeRect(15, 15, 482, 290);
    ctx.fillStyle = '#e5c783'; ctx.textAlign = 'center'; ctx.font = '34px Georgia';
    ctx.fillText(['Librairie', 'Maison', 'Galerie'][type], 256, 136);
    ctx.font = '30px Georgia'; ctx.fillText(['des Rêves', 'Fleury', 'Saint-Clair'][type], 256, 187);
    ctx.font = '21px Georgia'; ctx.fillText('•  depuis 1924  •', 256, 249);
  });
  const sign = box(group, 'Hanging sign | both readable faces', [0.06, 0.85, 1.3], [-3.07, 2.65, d / 2 + 0.82], materials.iron);
  sign.material = [paint('#fff', signMap), paint('#fff', signMap), materials.iron, materials.iron, materials.iron, materials.iron];
  box(group, 'Sign iron bracket', [0.05, 0.05, 1.5], [-3.07, 3.2, d / 2 + 0.65], materials.iron);
  for (const zz of [d / 2 + 0.3, d / 2 + 1.3]) box(group, 'Sign hanging chain', [0.026, 0.16, 0.026], [-3.07, 3.12, zz], materials.iron);
  group.position.set(x, 0, z); group.rotation.y = facing; parent.add(group);
  return group;
}
